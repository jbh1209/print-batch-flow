
import { supabase } from "@/integrations/supabase/client";
import type { ParsedJob, ExcelImportDebugger } from './types';
import { TimingCalculationService } from "@/services/timingCalculationService";
import { initializeJobWorkflow } from "@/utils/jobWorkflowInitializer";

interface UserApprovedMapping {
  groupName: string;
  mappedStageId: string;
  mappedStageName: string;
  category: string;
  mappedStageSpecId?: string;
  mappedStageSpecName?: string;
  paperSpecification?: string;
  partType?: string;
  qty?: number;
}

interface JobCreationResult {
  stats: {
    total: number;
    successful: number;
    failed: number;
  };
  createdJobs: any[];
  failedJobs: Array<{
    job: ParsedJob;
    error: string;
  }>;
}

interface JobPreparationResult extends JobCreationResult {
  preparedJobs: any[];
  userApprovedStageMappings?: UserApprovedMapping[];
  generateQRCodes: boolean;
}

/**
 * Enhanced Job Creator - Phase 4 implementation
 * Handles production-ready job creation with workflow initialization and timing calculations
 */
export class EnhancedJobCreator {
  private logger: ExcelImportDebugger;
  private userId: string;
  private generateQRCodes: boolean;

  constructor(logger: ExcelImportDebugger, userId: string, generateQRCodes: boolean = true) {
    this.logger = logger;
    this.userId = userId;
    this.generateQRCodes = generateQRCodes;
  }

  async initialize(): Promise<void> {
    this.logger.addDebugInfo(`🚀 Enhanced Job Creator initialized for user ${this.userId}`);
  }

  /**
   * Prepare jobs for review without saving to database
   */
  async prepareEnhancedJobsWithExcelData(
    jobs: ParsedJob[],
    headers: string[],
    dataRows: any[][],
    userApprovedStageMappings: UserApprovedMapping[] = []
  ): Promise<JobPreparationResult> {
    this.logger.addDebugInfo(`📋 Preparing ${jobs.length} jobs for review`);

    const preparedJobs = jobs.map((job, index) => ({
      ...job,
      excelHeaders: headers,
      excelRow: dataRows[index],
      userApprovedStageMappings: userApprovedStageMappings.length > 0 ? userApprovedStageMappings : []
    }));

    const result: JobPreparationResult = {
      stats: {
        total: jobs.length,
        successful: 0, // Will be filled when jobs are actually created
        failed: 0
      },
      createdJobs: [],
      failedJobs: [],
      preparedJobs,
      userApprovedStageMappings,
      generateQRCodes: this.generateQRCodes
    };

    this.logger.addDebugInfo(`✅ Prepared ${preparedJobs.length} jobs for review`);
    return result;
  }

  /**
   * Create production-ready jobs with workflows
   */
  async createEnhancedJobsWithExcelData(
    jobs: ParsedJob[],
    headers: string[],
    dataRows: any[][]
  ): Promise<JobCreationResult> {
    this.logger.addDebugInfo(`🏭 Creating ${jobs.length} production-ready jobs`);

    const result: JobCreationResult = {
      stats: {
        total: jobs.length,
        successful: 0,
        failed: 0
      },
      createdJobs: [],
      failedJobs: []
    };

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      
      try {
        this.logger.addDebugInfo(`📝 Creating job ${i + 1}/${jobs.length}: ${job.wo_no}`);
        
        const createdJob = await this.createSingleJob(job, headers, dataRows[i]);
        
        if (createdJob) {
          result.createdJobs.push(createdJob);
          result.stats.successful++;
          this.logger.addDebugInfo(`✅ Successfully created job: ${job.wo_no}`);
        } else {
          result.failedJobs.push({
            job,
            error: 'Failed to create job - unknown error'
          });
          result.stats.failed++;
        }
      } catch (error) {
        this.logger.addDebugInfo(`❌ Failed to create job ${job.wo_no}: ${error}`);
        result.failedJobs.push({
          job,
          error: String(error)
        });
        result.stats.failed++;
      }
    }

    this.logger.addDebugInfo(`🎯 Job creation completed: ${result.stats.successful}/${result.stats.total} successful`);
    return result;
  }

  /**
   * Finalize prepared jobs by saving them to database
   */
  async finalizeJobs(
    preparedResult: JobPreparationResult,
    userApprovedMappings?: UserApprovedMapping[]
  ): Promise<JobCreationResult> {
    this.logger.addDebugInfo(`🎯 Finalizing ${preparedResult.preparedJobs.length} prepared jobs`);

    const result: JobCreationResult = {
      stats: {
        total: preparedResult.preparedJobs.length,
        successful: 0,
        failed: 0
      },
      createdJobs: [],
      failedJobs: []
    };

    for (const preparedJob of preparedResult.preparedJobs) {
      try {
        this.logger.addDebugInfo(`📝 Finalizing job: ${preparedJob.wo_no}`);
        
        // Use user-approved mappings if provided, otherwise fall back to prepared mappings
        const finalMappings = userApprovedMappings && userApprovedMappings.length > 0 
          ? userApprovedMappings 
          : preparedJob.userApprovedStageMappings || [];

        const createdJob = await this.createSingleJobWithMappings(
          preparedJob,
          preparedJob.excelHeaders || [],
          preparedJob.excelRow || [],
          finalMappings
        );
        
        if (createdJob) {
          result.createdJobs.push(createdJob);
          result.stats.successful++;
          this.logger.addDebugInfo(`✅ Successfully finalized job: ${preparedJob.wo_no}`);
        } else {
          result.failedJobs.push({
            job: preparedJob,
            error: 'Failed to finalize job - unknown error'
          });
          result.stats.failed++;
        }
      } catch (error) {
        this.logger.addDebugInfo(`❌ Failed to finalize job ${preparedJob.wo_no}: ${error}`);
        result.failedJobs.push({
          job: preparedJob,
          error: String(error)
        });
        result.stats.failed++;
      }
    }

    this.logger.addDebugInfo(`🎯 Job finalization completed: ${result.stats.successful}/${result.stats.total} successful`);
    return result;
  }

  private async createSingleJob(
    job: ParsedJob,
    headers: string[],
    excelRow: any[]
  ): Promise<any> {
    return this.createSingleJobWithMappings(job, headers, excelRow, []);
  }

  private async createSingleJobWithMappings(
    job: ParsedJob,
    headers: string[],
    excelRow: any[],
    userApprovedMappings: UserApprovedMapping[]
  ): Promise<any> {
    // Create the production job
    const { data: createdJob, error: jobError } = await supabase
      .from('production_jobs')
      .insert({
        wo_no: job.wo_no,
        status: job.status || 'Pre-Press',
        customer: job.customer || '',
        reference: job.reference || '',
        qty: job.qty || 0,
        date: job.date || null,
        due_date: job.due_date || null,
        rep: job.rep || '',
        category: job.category || '',
        location: job.location || '',
        contact: job.contact || '',
        size: job.size || '',
        specification: job.specification || '',
        user_id: this.userId,
        qr_code_data: this.generateQRCodes ? `WO:${job.wo_no}` : null,
        // Enhanced job metadata
        paper_specifications: job.paperSpecifications || {},
        delivery_specifications: job.deliverySpecifications || {},
        finishing_specifications: job.finishingSpecifications || {},
        prepress_specifications: job.prepressSpecifications || {},
        printing_specifications: job.printingSpecifications || {},
        operation_quantities: job.operationQuantities || {}
      })
      .select()
      .single();

    if (jobError) {
      throw new Error(`Failed to create job: ${jobError.message}`);
    }

    this.logger.addDebugInfo(`📋 Created production job ${createdJob.id} for WO: ${job.wo_no}`);

    // Initialize workflow with user-approved mappings if available
    const workflowSuccess = await initializeJobWorkflow(
      createdJob.id,
      userApprovedMappings,
      job.categoryId || null,
      this.logger
    );

    if (!workflowSuccess) {
      this.logger.addDebugInfo(`⚠️ Failed to initialize workflow for job ${createdJob.id}, but job was created successfully`);
    }

    // Calculate timing for all created stage instances
    await this.calculateTimingForJob(createdJob.id, userApprovedMappings);

    return {
      ...createdJob,
      workflowInitialized: workflowSuccess,
      userApprovedMappings,
      excelData: {
        headers,
        row: excelRow
      }
    };
  }

  /**
   * Calculate timing estimates for all stage instances of a job
   */
  private async calculateTimingForJob(
    jobId: string,
    userApprovedMappings: UserApprovedMapping[]
  ): Promise<void> {
    try {
      this.logger.addDebugInfo(`⏱️ Starting timing calculations for job ${jobId}`);
      
      // Fetch all stage instances for this job - INCLUDING unique_stage_key
      const { data: stageInstances, error } = await supabase
        .from('job_stage_instances')
        .select('id, production_stage_id, stage_specification_id, quantity, unique_stage_key')
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs')
        .order('stage_order');
      
      if (error) {
        this.logger.addDebugInfo(`❌ Failed to fetch stage instances for timing calculation: ${error.message}`);
        return;
      }
      
      if (!stageInstances || stageInstances.length === 0) {
        this.logger.addDebugInfo(`⚠️ No stage instances found for job ${jobId}, skipping timing calculation`);
        return;
      }
      
      // Create a map of unique stage keys to quantities from user mappings
      const quantityMap = new Map<string, number>();
      userApprovedMappings.forEach(mapping => {
        if (mapping.qty && mapping.qty > 0) {
          quantityMap.set(mapping.mappedStageId, mapping.qty);
        }
      });
      
      this.logger.addDebugInfo(`📊 Found ${quantityMap.size} stage quantities from user mappings`);
      
      // Calculate timing for each stage instance using unique_stage_key for quantity lookup
      const timingPromises = stageInstances.map(async (stageInstance) => {
        // Use unique_stage_key if available, otherwise fall back to production_stage_id
        const lookupKey = stageInstance.unique_stage_key || stageInstance.production_stage_id;
        const quantity = quantityMap.get(lookupKey) || stageInstance.quantity || 1;
        
        this.logger.addDebugInfo(`⏱️ Calculating timing for stage instance ${stageInstance.id} (key: ${lookupKey}) with quantity ${quantity}`);
        
        try {
          // Update the stage instance with quantity and calculated timing
          const { error: updateError } = await supabase
            .from('job_stage_instances')
            .update({
              quantity: quantity,
              updated_at: new Date().toISOString()
            })
            .eq('id', stageInstance.id);
          
          if (updateError) {
            this.logger.addDebugInfo(`❌ Failed to update stage instance ${stageInstance.id}: ${updateError.message}`);
            return false;
          }
          
          // Now calculate timing using the service
          const timingResult = await TimingCalculationService.calculateStageTimingWithInheritance({
            quantity: quantity,
            stageId: stageInstance.production_stage_id,
            specificationId: stageInstance.stage_specification_id
          });
          
          // Update the stage instance with the calculated timing
          const { error: timingUpdateError } = await supabase
            .from('job_stage_instances')
            .update({
              estimated_duration_minutes: timingResult.estimatedDurationMinutes,
              updated_at: new Date().toISOString()
            })
            .eq('id', stageInstance.id);
          
          if (timingUpdateError) {
            this.logger.addDebugInfo(`❌ Failed to update timing for stage instance ${stageInstance.id}: ${timingUpdateError.message}`);
            return false;
          }
          
          this.logger.addDebugInfo(`✅ Updated stage instance ${stageInstance.id} with ${timingResult.estimatedDurationMinutes} minutes`);
          return true;
        } catch (error) {
          this.logger.addDebugInfo(`❌ Error calculating timing for stage instance ${stageInstance.id}: ${error}`);
          return false;
        }
      });
      
      const results = await Promise.all(timingPromises);
      const successCount = results.filter(result => result === true).length;
      
      this.logger.addDebugInfo(`🎯 Timing calculation completed: ${successCount}/${stageInstances.length} successful`);
      
    } catch (error) {
      this.logger.addDebugInfo(`❌ Error in timing calculation process: ${error}`);
    }
  }
}
