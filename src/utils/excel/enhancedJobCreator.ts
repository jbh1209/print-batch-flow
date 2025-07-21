import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/integrations/supabase/client';
import type { ExcelImportDebugger } from './debugger';
import type { ParsedJob, RowMappingResult, StageMapping } from './types';
import { calculateEstimatedTime } from './timeEstimator';

interface EnhancedJobAssignment {
  originalJob: ParsedJob;
  rowMappings: RowMappingResult[];
}

interface PreparedJobResult {
  enhancedJobAssignments: EnhancedJobAssignment[];
  generateQRCodes: boolean;
  stats: {
    total: number;
    successful: number;
    failed: number;
  };
}

export class EnhancedJobCreator {
  private logger: ExcelImportDebugger;
  private userId: string;
  private generateQRCodes: boolean;

  constructor(logger: ExcelImportDebugger, userId: string, generateQRCodes: boolean = true) {
    this.logger = logger;
    this.userId = userId;
    this.generateQRCodes = generateQRCodes;
  }

  async createJobsFromMappings(preparedResult: PreparedJobResult): Promise<any> {
    this.logger.addDebugInfo('Starting enhanced job creation process...');

    let successfulJobs = 0;
    let failedJobs = 0;

    for (const jobAssignment of preparedResult.enhancedJobAssignments) {
      try {
        await this.createJobWithStages(jobAssignment.originalJob, jobAssignment.rowMappings);
        successfulJobs++;
      } catch (error: any) {
        this.logger.addError(`Failed to create job for WO ${jobAssignment.originalJob.wo_no}: ${error.message}`);
        failedJobs++;
      }
    }

    const finalStats = {
      total: preparedResult.enhancedJobAssignments.length,
      successful: successfulJobs,
      failed: failedJobs,
    };

    this.logger.addDebugInfo(`Job creation completed. Total: ${finalStats.total}, Successful: ${finalStats.successful}, Failed: ${finalStats.failed}`);

    return {
      stats: finalStats,
    };
  }

  private async createJobWithStages(originalJob: ParsedJob, rowMappings: RowMappingResult[]): Promise<void> {
    this.logger.addDebugInfo(`Creating job with stages for WO: ${originalJob.wo_no}`);

    // Step 1: Create the base job record
    const jobData = this.prepareJobData(originalJob);
    const { data: createdJob, error: jobError } = await supabase
      .from('production_jobs')
      .insert([jobData])
      .select()
      .single();

    if (jobError) {
      this.logger.addError(`Error creating job: ${jobError.message}`);
      throw new Error(`Failed to create job: ${jobError.message}`);
    }

    if (!createdJob) {
      this.logger.addError('Failed to create job: No job record returned.');
      throw new Error('Failed to create job: No job record returned.');
    }

    this.logger.addDebugInfo(`Job created successfully with ID: ${createdJob.id}`);

    // Step 2: Create stage instances based on row mappings
    try {
      await this.createStageInstances(createdJob.id, rowMappings);
    } catch (stageError: any) {
      this.logger.addError(`Error creating stage instances: ${stageError.message}`);
      throw new Error(`Failed to create stage instances: ${stageError.message}`);
    }

    // Step 3: (If applicable) Initialize custom job stages with specifications
    if (originalJob.cover_text_detection?.isBookJob) {
      try {
        await this.initializeCustomJobStages(createdJob.id, originalJob, rowMappings);
      } catch (customStageError: any) {
        this.logger.addError(`Error initializing custom job stages: ${customStageError.message}`);
        throw new Error(`Failed to initialize custom job stages: ${customStageError.message}`);
      }
    } else {
      this.logger.addDebugInfo(`Skipping custom job stage initialization for WO: ${originalJob.wo_no}`);
    }

    // Step 4: Update quantities based on stage specifications
    try {
      await this.updateQuantities(createdJob.id);
    } catch (quantityError: any) {
      this.logger.addError(`Error updating quantities: ${quantityError.message}`);
      throw new Error(`Failed to update quantities: ${quantityError.message}`);
    }

    this.logger.addDebugInfo(`Job and stages created successfully for WO: ${originalJob.wo_no}`);
  }

  private prepareJobData(originalJob: ParsedJob): any {
    const jobData: any = {
      id: uuidv4(),
      wo_number: originalJob.wo_no,
      status: originalJob.status,
      customer: originalJob.customer,
      reference: originalJob.reference,
      quantity: originalJob.qty,
      location: originalJob.location,
      due_date: originalJob.due_date,
      category: originalJob.category,
      rep: originalJob.rep,
      date: originalJob.date,
      estimated_hours: originalJob.estimated_hours,
      setup_time_minutes: originalJob.setup_time_minutes,
      running_speed: originalJob.running_speed,
      speed_unit: originalJob.speed_unit,
      specifications: originalJob.specifications,
      paper_weight: originalJob.paper_weight,
      paper_type: originalJob.paper_type,
      lamination: originalJob.lamination,
      size: originalJob.size,
      contact: originalJob.contact,
      created_by: this.userId,
      updated_by: this.userId,
      has_custom_workflow: false, // Default value, will be updated if necessary
    };

    this.logger.addDebugInfo(`Prepared job data for WO: ${originalJob.wo_no}`);
    return jobData;
  }

  private async createStageInstances(jobId: string, rowMappings: RowMappingResult[]): Promise<void> {
    this.logger.addDebugInfo(`Creating stage instances for job ID: ${jobId}`);

    for (const rowMapping of rowMappings) {
      if (rowMapping.isUnmapped || rowMapping.ignored) {
        this.logger.addDebugInfo(`Skipping unmapped/ignored row for group: ${rowMapping.groupName}`);
        continue;
      }

      if (!rowMapping.mappedStageId) {
        this.logger.addWarn(`No mapped stage ID found for group: ${rowMapping.groupName}`);
        continue;
      }

      const stageData = {
        id: uuidv4(),
        job_id: jobId,
        job_table_name: 'production_jobs',
        category_id: null, // No category for custom workflows with specifications
        production_stage_id: rowMapping.mappedStageId,
        stage_specification_id: rowMapping.mappedStageSpecId,
        stage_order: 1, // Default order
        part_name: rowMapping.description,
        quantity: rowMapping.qty,
        status: 'pending', // Default status
        started_at: null,
        started_by: null,
        notes: null,
        created_by: this.userId,
        updated_by: this.userId,
        unique_stage_key: rowMapping.instanceId,
      };

      const { error: stageError } = await supabase
        .from('job_stage_instances')
        .insert([stageData]);

      if (stageError) {
        this.logger.addError(`Error creating stage instance for group ${rowMapping.groupName}: ${stageError.message}`);
        throw new Error(`Failed to create stage instance: ${stageError.message}`);
      }

      this.logger.addDebugInfo(`Created stage instance for group: ${rowMapping.groupName} with stage ID: ${rowMapping.mappedStageId}`);
    }

    this.logger.addDebugInfo(`Stage instances creation completed for job ID: ${jobId}`);
  }

  private async initializeCustomJobStages(jobId: string, originalJob: ParsedJob, rowMappings: RowMappingResult[]): Promise<void> {
    this.logger.addDebugInfo(`Initializing custom job stages for job ID: ${jobId}`);

    if (!originalJob.cover_text_detection || !originalJob.cover_text_detection.isBookJob) {
      this.logger.addDebugInfo('Skipping custom job stage initialization: Not a book job.');
      return;
    }

    const stageMappings = this.createStageMappings(originalJob, rowMappings);

    if (!stageMappings || stageMappings.length === 0) {
      this.logger.addWarn('No stage mappings found for custom job stages.');
      return;
    }

    // Call the Supabase function to initialize custom job stages
    const { data, error } = await supabase.rpc('initialize_custom_job_stages_with_specs', {
      p_job_id: jobId,
      p_job_table_name: 'production_jobs',
      p_stage_mappings: stageMappings,
    });

    if (error) {
      this.logger.addError(`Error initializing custom job stages via function: ${error.message}`);
      throw new Error(`Failed to initialize custom job stages: ${error.message}`);
    }

    this.logger.addDebugInfo(`Custom job stages initialized successfully for job ID: ${jobId}`);
  }

  private createStageMappings(originalJob: ParsedJob, rowMappings: RowMappingResult[]): any[] {
    this.logger.addDebugInfo(`Creating stage mappings for WO: ${originalJob.wo_no}`);

    if (!originalJob.cover_text_detection || !originalJob.cover_text_detection.isBookJob) {
      this.logger.addDebugInfo('Skipping stage mapping creation: Not a book job.');
      return [];
    }

    const stageMappings: any[] = [];
    let stageOrder = 1;

    for (const component of originalJob.cover_text_detection.components) {
      const printing = component.printing;
      const paper = component.paper;

      if (printing) {
        const printingMapping = rowMappings.find(rm =>
          rm.description === printing.description && rm.qty === printing.qty
        );

        if (printingMapping && printingMapping.mappedStageId) {
          stageMappings.push({
            stage_id: printingMapping.mappedStageId,
            unique_stage_id: printingMapping.instanceId,
            stage_order: stageOrder++,
            stage_specification_id: printingMapping.mappedStageSpecId || null,
            part_name: printing.description,
            quantity: printing.qty,
            paper_specification: printingMapping.paperSpecification || null,
          });
        } else {
          this.logger.addWarn(`No stage mapping found for printing description: ${printing.description}`);
        }
      }

      if (paper) {
        const paperMapping = rowMappings.find(rm =>
          rm.description === paper.description && rm.qty === paper.qty
        );

        if (paperMapping && paperMapping.mappedStageId) {
          stageMappings.push({
            stage_id: paperMapping.mappedStageId,
            unique_stage_id: paperMapping.instanceId,
            stage_order: stageOrder++,
            stage_specification_id: paperMapping.mappedStageSpecId || null,
            part_name: paper.description,
            quantity: paper.qty,
            paper_specification: paperMapping.paperSpecification || null,
          });
        } else {
          this.logger.addWarn(`No stage mapping found for paper description: ${paper.description}`);
        }
      }
    }

    this.logger.addDebugInfo(`Created ${stageMappings.length} stage mappings for WO: ${originalJob.wo_no}`);
    return stageMappings;
  }

  private async updateQuantities(jobId: string): Promise<void> {
    this.logger.addDebugInfo(`Updating quantities for job ${jobId}`);

    try {
      // Get all stage specifications for this job
      const { data: stageSpecs, error: specsError } = await supabase
        .from('job_stage_instances')
        .select('stage_specification_id, quantity, unique_stage_key, production_stage_id')
        .eq('job_id', jobId)
        .not('stage_specification_id', 'is', null);

      if (specsError) {
        this.logger.addDebugInfo(`Error fetching stage specifications: ${specsError.message}`);
        throw specsError;
      }

      if (!stageSpecs || stageSpecs.length === 0) {
        this.logger.addDebugInfo('No stage specifications found for quantity update');
        return;
      }

      // Create a map of stage specification ID to quantity
      const quantityMap = new Map<string, number>();
      stageSpecs.forEach(spec => {
        if (spec.unique_stage_key) {
          quantityMap.set(spec.unique_stage_key, spec.quantity);
        } else {
          quantityMap.set(spec.production_stage_id, spec.quantity);
        }
      });

      await this.updateStageQuantities(jobId, quantityMap);

    } catch (error) {
      this.logger.addDebugInfo(`Error in updateQuantities: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private async updateStageQuantities(jobId: string, quantityMap: Map<string, number>): Promise<void> {
    this.logger.addDebugInfo(`Updating stage quantities for job ${jobId}`);
    
    try {
      // Get all stage instances for this job
      const { data: stageInstances, error } = await supabase
        .from('job_stage_instances')
        .select('id, production_stage_id, stage_specification_id, quantity, part_name, unique_stage_key')
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs');

      if (error) {
        this.logger.addDebugInfo(`Error fetching stage instances: ${error.message}`);
        throw error;
      }

      if (!stageInstances || stageInstances.length === 0) {
        this.logger.addDebugInfo('No stage instances found for quantity update');
        return;
      }

      this.logger.addDebugInfo(`Found ${stageInstances.length} stage instances to update`);

      // Update each stage instance with its mapped quantity
      const updates = stageInstances.map(stageInstance => {
        // Try unique_stage_key first, then fall back to production_stage_id
        const quantity = quantityMap.get((stageInstance as any).unique_stage_key || stageInstance.production_stage_id) || 
                        quantityMap.get(stageInstance.production_stage_id) || 
                        100; // Default fallback

        this.logger.addDebugInfo(`Stage ${stageInstance.production_stage_id} (${(stageInstance as any).unique_stage_key || 'no unique key'}): setting quantity to ${quantity}`);

        return supabase
          .from('job_stage_instances')
          .update({ 
            quantity,
            estimated_duration_minutes: this.calculateEstimatedDuration(quantity, stageInstance.stage_specification_id)
          })
          .eq('id', stageInstance.id);
      });

      // Execute all updates
      await Promise.all(updates);
      this.logger.addDebugInfo(`Successfully updated quantities for ${updates.length} stage instances`);

    } catch (error) {
      this.logger.addDebugInfo(`Error in updateStageQuantities: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private calculateEstimatedDuration(quantity: number, stageSpecificationId: string | null): number | null {
    if (!stageSpecificationId) {
      return null;
    }

    // Fetch the stage specification to get the estimated time parameters
    return calculateEstimatedTime(stageSpecificationId, quantity);
  }
}
