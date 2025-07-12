import type { ParsedJob } from './types';
import type { ExcelImportDebugger } from './debugger';
import { ProductionStageMapper, type CategoryAssignmentResult } from './productionStageMapper';
import { supabase } from '@/integrations/supabase/client';
import { generateQRCodeData, generateQRCodeImage } from '@/utils/qrCodeGenerator';

export interface EnhancedJobCreationResult {
  success: boolean;
  createdJobs: any[];
  failedJobs: { job: ParsedJob; error: string }[];
  categoryAssignments: { [woNo: string]: CategoryAssignmentResult };
  stats: {
    total: number;
    successful: number;
    failed: number;
    newCategories: number;
    workflowsInitialized: number;
  };
}

export class EnhancedJobCreator {
  private stageMapper: ProductionStageMapper;

  constructor(
    private logger: ExcelImportDebugger,
    private userId: string,
    private generateQRCodes: boolean = true
  ) {
    this.stageMapper = new ProductionStageMapper(logger);
  }

  async initialize(): Promise<void> {
    await this.stageMapper.initialize();
  }

  /**
   * Create fully qualified production jobs with workflow initialization
   */
  async createEnhancedJobs(jobs: ParsedJob[]): Promise<EnhancedJobCreationResult> {
    this.logger.addDebugInfo(`Starting enhanced job creation for ${jobs.length} jobs`);

    const result: EnhancedJobCreationResult = {
      success: true,
      createdJobs: [],
      failedJobs: [],
      categoryAssignments: {},
      stats: {
        total: jobs.length,
        successful: 0,
        failed: 0,
        newCategories: 0,
        workflowsInitialized: 0
      }
    };

    for (const job of jobs) {
      try {
        await this.processJob(job, result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.addDebugInfo(`Failed to process job ${job.wo_no}: ${errorMessage}`);
        result.failedJobs.push({ job, error: errorMessage });
        result.stats.failed++;
      }
    }

    result.success = result.stats.failed === 0;
    this.logger.addDebugInfo(`Enhanced job creation completed: ${result.stats.successful}/${result.stats.total} successful`);

    return result;
  }

  private async processJob(job: ParsedJob, result: EnhancedJobCreationResult): Promise<void> {
    this.logger.addDebugInfo(`Processing job: ${job.wo_no}`);

    // 1. Map specifications to production stages
    const mappedStages = this.stageMapper.mapGroupsToStages(
      job.printing_specifications,
      job.finishing_specifications,
      job.prepress_specifications
    );

    // 2. Assign category or create custom workflow
    const categoryAssignment = this.stageMapper.assignCategory(mappedStages);
    result.categoryAssignments[job.wo_no] = categoryAssignment;

    // 3. Handle category assignment
    let finalCategoryId = categoryAssignment.categoryId;

    if (!finalCategoryId && categoryAssignment.requiresCustomWorkflow && mappedStages.length > 0) {
      // Create dynamic category for custom workflow
      finalCategoryId = await this.stageMapper.createDynamicCategory(
        mappedStages,
        job.reference || job.wo_no
      );
      result.stats.newCategories++;
      categoryAssignment.categoryId = finalCategoryId;
      categoryAssignment.categoryName = `Auto-Generated: ${job.reference || job.wo_no}`;
    }

    // 4. Create enhanced job data
    const enhancedJobData = await this.buildEnhancedJobData(job, finalCategoryId);

    // 5. Insert job into database
    const { data: insertedJob, error: insertError } = await supabase
      .from('production_jobs')
      .upsert(enhancedJobData, { 
        onConflict: 'wo_no,user_id',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Database insertion failed: ${insertError.message}`);
    }

    // 6. Initialize workflow if category was assigned
    if (finalCategoryId) {
      await this.initializeJobWorkflow(insertedJob.id, finalCategoryId);
      result.stats.workflowsInitialized++;
    }

    // 7. Update QR codes with actual job ID
    if (this.generateQRCodes && insertedJob.qr_code_data) {
      await this.updateJobQRCode(insertedJob);
    }

    result.createdJobs.push(insertedJob);
    result.stats.successful++;
  }

  private async buildEnhancedJobData(job: ParsedJob, categoryId: string | null): Promise<any> {
    // Build comprehensive job data with all specifications
    const jobData: any = {
      wo_no: job.wo_no,
      user_id: this.userId,
      status: 'Pre-Press',
      customer: job.customer || '',
      reference: job.reference || '',
      rep: job.rep || '',
      qty: job.qty || 0,
      location: job.location || '',
      size: job.size || null,
      specification: job.specification || null,
      contact: job.contact || null,
      date: job.date || null,
      due_date: job.due_date || null,
      category_id: categoryId,
      
      // Enhanced specifications from groups
      paper_specifications: this.buildPaperSpecifications(job),
      delivery_specifications: this.buildDeliverySpecifications(job),
      printing_specifications: this.buildPrintingSpecifications(job),
      finishing_specifications: this.buildFinishingSpecifications(job),
      prepress_specifications: this.buildPrepressSpecifications(job),
      operation_quantities: job.operation_quantities || {},
      
      // Workflow flags
      has_custom_workflow: !categoryId || false
    };

    // Generate QR code if enabled
    if (this.generateQRCodes) {
      const qrData = generateQRCodeData({
        wo_no: job.wo_no,
        job_id: `temp-${job.wo_no}`,
        customer: job.customer || '',
        due_date: job.due_date
      });
      
      jobData.qr_code_data = qrData;
      jobData.qr_code_url = await generateQRCodeImage(qrData);
    }

    return jobData;
  }

  private buildPaperSpecifications(job: ParsedJob): any {
    const paperSpecs: any = {};

    // Include original paper type/weight if available
    if (job.paper_type || job.paper_weight) {
      paperSpecs.legacy_paper = {
        type: job.paper_type,
        weight: job.paper_weight
      };
    }

    // Include group-based paper specifications
    if (job.paper_specifications) {
      paperSpecs.group_specifications = job.paper_specifications;
    }

    return Object.keys(paperSpecs).length > 0 ? paperSpecs : {};
  }

  private buildDeliverySpecifications(job: ParsedJob): any {
    if (!job.delivery_specifications) return {};

    return {
      group_specifications: job.delivery_specifications,
      parsed_delivery: this.extractDeliveryMethod(job.delivery_specifications)
    };
  }

  private extractDeliveryMethod(deliverySpecs: any): any {
    // Simple delivery method extraction from group specifications
    for (const [key, spec] of Object.entries(deliverySpecs)) {
      const description = (spec as any).description?.toLowerCase() || '';
      if (description.includes('delivery') || description.includes('courier')) {
        return { method: 'delivery', details: description };
      }
      if (description.includes('collection') || description.includes('pickup')) {
        return { method: 'collection', details: description };
      }
    }
    return { method: 'collection', details: 'Auto-detected from specifications' };
  }

  private buildPrintingSpecifications(job: ParsedJob): any {
    if (!job.printing_specifications) return {};

    const printingSpecs = {
      group_specifications: job.printing_specifications,
      detected_stages: this.extractPrintingStages(job.printing_specifications)
    };

    return printingSpecs;
  }

  private buildFinishingSpecifications(job: ParsedJob): any {
    if (!job.finishing_specifications) return {};

    return {
      group_specifications: job.finishing_specifications,
      detected_stages: this.extractFinishingStages(job.finishing_specifications)
    };
  }

  private buildPrepressSpecifications(job: ParsedJob): any {
    if (!job.prepress_specifications) return {};

    return {
      group_specifications: job.prepress_specifications,
      detected_stages: this.extractPrepressStages(job.prepress_specifications)
    };
  }

  private extractPrintingStages(printingSpecs: any): string[] {
    const stages: string[] = [];
    for (const [key, spec] of Object.entries(printingSpecs)) {
      stages.push(key);
    }
    return stages;
  }

  private extractFinishingStages(finishingSpecs: any): string[] {
    const stages: string[] = [];
    for (const [key, spec] of Object.entries(finishingSpecs)) {
      stages.push(key);
    }
    return stages;
  }

  private extractPrepressStages(prepressSpecs: any): string[] {
    const stages: string[] = [];
    for (const [key, spec] of Object.entries(prepressSpecs)) {
      stages.push(key);
    }
    return stages;
  }

  private async initializeJobWorkflow(jobId: string, categoryId: string): Promise<void> {
    this.logger.addDebugInfo(`Initializing workflow for job ${jobId} with category ${categoryId}`);

    // Use existing Supabase function to initialize workflow
    const { error } = await supabase.rpc('initialize_job_stages_auto', {
      p_job_id: jobId,
      p_job_table_name: 'production_jobs',
      p_category_id: categoryId
    });

    if (error) {
      throw new Error(`Failed to initialize workflow: ${error.message}`);
    }

    // Update stage instances with appropriate quantities based on operation_quantities
    await this.updateStageQuantities(jobId);
  }

  private async updateStageQuantities(jobId: string): Promise<void> {
    try {
      this.logger.addDebugInfo(`Updating stage quantities for job ${jobId}`);
      
      // Get the job's operation quantities
      const { data: job, error: jobError } = await supabase
        .from('production_jobs')
        .select('operation_quantities')
        .eq('id', jobId)
        .single();

      if (jobError || !job?.operation_quantities) {
        this.logger.addDebugInfo('No operation quantities found, skipping stage quantity updates');
        return;
      }

      // Get the job's stage instances
      const { data: stages, error: stagesError } = await supabase
        .from('job_stage_instances')
        .select('id, production_stage_id')
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs');

      if (stagesError || !stages) {
        this.logger.addDebugInfo('No stage instances found for quantity updates');
        return;
      }

      // Update each stage with appropriate quantity based on its type
      for (const stage of stages) {
        const appropriateQuantity = this.getApropriateQuantityForStage(stage.production_stage_id, job.operation_quantities);
        
        if (appropriateQuantity > 0) {
          await supabase
            .from('job_stage_instances')
            .update({ quantity: appropriateQuantity })
            .eq('id', stage.id);
        }
      }
    } catch (error) {
      this.logger.addDebugInfo(`Failed to update stage quantities: ${error}`);
    }
  }

  private getApropriateQuantityForStage(stageId: string, operationQuantities: any): number {
    // Logic to determine which quantity to use for different stage types
    // For now, return the first available quantity
    // This could be enhanced with stage-specific logic
    for (const operation of Object.values(operationQuantities)) {
      const opData = operation as any;
      if (opData.operation_qty > 0) {
        return opData.operation_qty;
      }
      if (opData.total_wo_qty > 0) {
        return opData.total_wo_qty;
      }
    }
    return 0;
  }

  private async calculateStageEstimateWithQuantityType(
    quantity: number, 
    runningSpeed: number, 
    makeReadyTime: number = 10,
    speedUnit: string = 'sheets_per_hour',
    quantityType: string = 'pieces'
  ): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('calculate_stage_duration_with_type', {
        p_quantity: quantity,
        p_running_speed_per_hour: runningSpeed,
        p_make_ready_time_minutes: makeReadyTime,
        p_speed_unit: speedUnit,
        p_quantity_type: quantityType
      });

      if (error) {
        this.logger.addDebugInfo(`Error calculating stage duration: ${error.message}`);
        return makeReadyTime; // Fallback to just make-ready time
      }

      return data || makeReadyTime;
    } catch (error) {
      this.logger.addDebugInfo(`Failed to calculate stage duration: ${error}`);
      return makeReadyTime;
    }
  }

  private async updateJobQRCode(job: any): Promise<void> {
    try {
      const updatedQrData = generateQRCodeData({
        wo_no: job.wo_no,
        job_id: job.id,
        customer: job.customer,
        due_date: job.due_date
      });
      
      const updatedQrUrl = await generateQRCodeImage(updatedQrData);
      
      await supabase
        .from('production_jobs')
        .update({
          qr_code_data: updatedQrData,
          qr_code_url: updatedQrUrl
        })
        .eq('id', job.id);
    } catch (error) {
      this.logger.addDebugInfo(`Failed to update QR code for job ${job.id}: ${error}`);
    }
  }
}