import { supabase } from '@/integrations/supabase/client';
import type { ParsedJob } from '@/utils/excel/types';
import type { ExcelImportDebugger } from '@/utils/excel/debugger';
import { generateQRCodeData, generateQRCodeImage } from '@/utils/qrCodeGenerator';

export interface DirectJobResult {
  success: boolean;
  createdJobs: any[];
  failedJobs: { job: ParsedJob; error: string }[];
  stats: {
    total: number;
    successful: number;
    failed: number;
  };
}

export class DirectJobCreator {
  constructor(
    private logger: ExcelImportDebugger,
    private userId: string,
    private generateQRCodes: boolean = true
  ) {}

  /**
   * Directly create production jobs with all specifications from Excel data
   * Preserves cover/text logic and paper mapping from the existing system
   */
  async createJobsFromMappings(
    preparedResult: any
  ): Promise<DirectJobResult> {
    const result: DirectJobResult = {
      success: true,
      createdJobs: [],
      failedJobs: [],
      stats: {
        total: Object.keys(preparedResult.categoryAssignments || {}).length,
        successful: 0,
        failed: 0
      }
    };

    this.logger.addDebugInfo(`Creating ${result.stats.total} jobs directly from prepared mappings`);

    // Process each prepared job
    for (const [woNo, assignment] of Object.entries(preparedResult.categoryAssignments || {})) {
      try {
        const originalJob = (assignment as any).originalJob;
        if (!originalJob) {
          throw new Error(`No original job data found for ${woNo}`);
        }

        // Create the job directly
        const createdJob = await this.createSingleJob(originalJob, preparedResult.rowMappings[woNo] || []);
        result.createdJobs.push(createdJob);
        result.stats.successful++;
        
        this.logger.addDebugInfo(`Successfully created job ${woNo}`);
      } catch (error) {
        this.logger.addDebugInfo(`Failed to create job ${woNo}: ${error}`);
        const originalJob = (preparedResult.categoryAssignments[woNo] as any)?.originalJob;
        result.failedJobs.push({
          job: originalJob || { wo_no: woNo } as ParsedJob,
          error: error instanceof Error ? error.message : String(error)
        });
        result.stats.failed++;
      }
    }

    result.success = result.stats.failed === 0;
    this.logger.addDebugInfo(`Direct job creation completed: ${result.stats.successful}/${result.stats.total} successful`);

    return result;
  }

  private async createSingleJob(originalJob: ParsedJob, rowMappings: any[]): Promise<any> {
    // Build job data preserving all specifications
    const jobData = {
      wo_no: originalJob.wo_no,
      customer: originalJob.customer || 'Imported Customer',
      reference: originalJob.reference || '',
      qty: originalJob.qty || 1,
      due_date: originalJob.due_date,
      user_id: this.userId,
      status: 'Pre-Press',
      has_custom_workflow: true,
      // Preserve all specifications from Excel parsing
      paper_specifications: originalJob.paper_specifications || {},
      printing_specifications: originalJob.printing_specifications || {},
      finishing_specifications: originalJob.finishing_specifications || {},
      prepress_specifications: originalJob.prepress_specifications || {},
      delivery_specifications: originalJob.delivery_specifications || {},
      operation_quantities: originalJob.operation_quantities || {},
      // Add QR code if enabled (will be updated with actual job_id after creation)
      qr_code_data: this.generateQRCodes ? JSON.stringify({
        wo_no: originalJob.wo_no,
        customer: originalJob.customer || 'Imported Customer',
        temporary: true
      }) : null
    };

    // Insert job into database
    const { data: insertedJob, error: insertError } = await supabase
      .from('production_jobs')
      .insert(jobData)
      .select()
      .single();

    let finalJob = insertedJob;

    if (insertError) {
      if (insertError.code === '23505') { // Unique constraint violation
        this.logger.addDebugInfo(`Job ${originalJob.wo_no} already exists, updating...`);
        
        const { data: updatedJob, error: updateError } = await supabase
          .from('production_jobs')
          .update({
            ...jobData,
            updated_at: new Date().toISOString()
          })
          .eq('wo_no', originalJob.wo_no)
          .eq('user_id', this.userId)
          .select()
          .single();

        if (updateError) {
          throw new Error(`Failed to update existing job: ${updateError.message}`);
        }
        
        finalJob = updatedJob;
      } else {
        throw new Error(`Database insertion failed: ${insertError.message}`);
      }
    }

    if (!finalJob) {
      throw new Error('Job creation returned no data');
    }

    // Initialize custom workflow from row mappings
    await this.initializeWorkflowFromMappings(finalJob, rowMappings);

    // Generate QR code image if enabled
    if (this.generateQRCodes && finalJob.qr_code_data) {
      try {
        // Update QR code with actual job ID
        const qrCodeData = generateQRCodeData({
          wo_no: finalJob.wo_no,
          job_id: finalJob.id,
          customer: finalJob.customer,
          due_date: finalJob.due_date
        });
        
        const qrCodeUrl = await generateQRCodeImage(qrCodeData);
        
        await supabase
          .from('production_jobs')
          .update({ 
            qr_code_data: qrCodeData,
            qr_code_url: qrCodeUrl 
          })
          .eq('id', finalJob.id);
        
        finalJob.qr_code_data = qrCodeData;
        finalJob.qr_code_url = qrCodeUrl;
      } catch (qrError) {
        this.logger.addDebugInfo(`Warning: QR code generation failed for ${originalJob.wo_no}: ${qrError}`);
      }
    }

    return finalJob;
  }

  private async initializeWorkflowFromMappings(job: any, rowMappings: any[]): Promise<void> {
    if (!rowMappings || rowMappings.length === 0) {
      this.logger.addDebugInfo(`No row mappings found for job ${job.wo_no}, skipping workflow initialization`);
      return;
    }

    // Extract stage IDs and orders from row mappings, preserving cover/text logic
    const stageIds: string[] = [];
    const stageOrders: number[] = [];
    
    // Sort by stage order to maintain correct sequence
    const sortedMappings = [...rowMappings].sort((a, b) => (a.stageOrder || 0) - (b.stageOrder || 0));
    
    for (const mapping of sortedMappings) {
      if (mapping.stageId) {
        stageIds.push(mapping.stageId);
        stageOrders.push(mapping.stageOrder || stageIds.length);
      }
    }

    if (stageIds.length === 0) {
      this.logger.addDebugInfo(`No valid stages found in mappings for job ${job.wo_no}`);
      return;
    }

    this.logger.addDebugInfo(`Initializing workflow for job ${job.wo_no} with ${stageIds.length} stages`);

    // Use existing RPC to initialize custom workflow
    const { error } = await supabase.rpc('initialize_custom_job_stages', {
      p_job_id: job.id,
      p_job_table_name: 'production_jobs',
      p_stage_ids: stageIds,
      p_stage_orders: stageOrders
    });

    if (error) {
      throw new Error(`Failed to initialize workflow: ${error.message}`);
    }

    // Add job print specifications and timing calculations for each stage
    await this.addStageSpecifications(job, rowMappings);
  }

  private async addStageSpecifications(job: any, rowMappings: any[]): Promise<void> {
    for (const mapping of rowMappings) {
      if (!mapping.stageId) continue;

      // Add paper specifications if available
      if (mapping.paperSpecification) {
        await supabase
          .from('job_print_specifications')
          .insert({
            job_id: job.id,
            job_table_name: 'production_jobs',
            specification_id: mapping.paperSpecification.id,
            specification_category: 'paper',
            printer_id: mapping.printerId || null
          });
      }

      // Update stage instance with quantity and timing information
      if (mapping.quantity) {
        const { error } = await supabase
          .from('job_stage_instances')
          .update({
            quantity: mapping.quantity,
            part_type: mapping.partType || null, // Preserve cover/text detection
            estimated_duration_minutes: mapping.estimatedDuration || null
          })
          .eq('job_id', job.id)
          .eq('production_stage_id', mapping.stageId);

        if (error) {
          this.logger.addDebugInfo(`Warning: Failed to update stage timing for ${job.wo_no}: ${error.message}`);
        }
      }
    }
  }
}