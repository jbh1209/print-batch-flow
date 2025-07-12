import type { ParsedJob, RowMappingResult } from './types';
import type { ExcelImportDebugger } from './debugger';
import { ProductionStageMapper, type CategoryAssignmentResult } from './productionStageMapper';
import { EnhancedStageMapper } from './enhancedStageMapper';
import { supabase } from '@/integrations/supabase/client';
import { generateQRCodeData, generateQRCodeImage } from '@/utils/qrCodeGenerator';
import { CoverTextWorkflowService } from '@/services/coverTextWorkflowService';

export interface EnhancedJobCreationResult {
  success: boolean;
  createdJobs: any[];
  failedJobs: { job: ParsedJob; error: string }[];
  categoryAssignments: { [woNo: string]: CategoryAssignmentResult };
  rowMappings: { [woNo: string]: RowMappingResult[] };
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
  private enhancedStageMapper: EnhancedStageMapper;
  private coverTextService: CoverTextWorkflowService;

  constructor(
    private logger: ExcelImportDebugger,
    private userId: string,
    private generateQRCodes: boolean = true
  ) {
    this.stageMapper = new ProductionStageMapper(logger);
    this.enhancedStageMapper = new EnhancedStageMapper(logger);
    this.coverTextService = new CoverTextWorkflowService(logger);
  }

  async initialize(): Promise<void> {
    await this.stageMapper.initialize();
    await this.enhancedStageMapper.initialize();
  }

  /**
   * Create fully qualified production jobs with workflow initialization
   */
  async createEnhancedJobs(jobs: ParsedJob[]): Promise<EnhancedJobCreationResult> {
    // Call the new method with empty arrays for backwards compatibility
    return this.createEnhancedJobsWithExcelData(jobs, [], []);
  }

  /**
   * Prepare enhanced jobs with mappings but don't save to database
   */
  async prepareEnhancedJobsWithExcelData(
    jobs: ParsedJob[], 
    headers: string[], 
    dataRows: any[][]
  ): Promise<EnhancedJobCreationResult> {
    this.logger.addDebugInfo(`Preparing enhanced jobs for ${jobs.length} parsed jobs with Excel data`);
    this.logger.addDebugInfo(`Excel headers: ${JSON.stringify(headers)}`);
    this.logger.addDebugInfo(`Excel data rows: ${dataRows.length}`);

    const result: EnhancedJobCreationResult = {
      success: true,
      createdJobs: [],
      failedJobs: [],
      categoryAssignments: {},
      rowMappings: {},
      stats: {
        total: jobs.length,
        successful: 0,
        failed: 0,
        newCategories: 0,
        workflowsInitialized: 0
      }
    };

    // Process each job for mapping but DON'T save to database
    for (let i = 0; i < jobs.length; i++) {
      try {
        await this.prepareJobWithExcelData(jobs[i], result, headers, dataRows[i] || []);
        result.stats.successful++;
      } catch (error) {
        this.logger.addDebugInfo(`Failed to prepare job ${jobs[i].wo_no}: ${error}`);
        result.failedJobs.push({
          job: jobs[i],
          error: error instanceof Error ? error.message : String(error)
        });
        result.stats.failed++;
      }
    }

    result.success = result.stats.failed === 0;
    this.logger.addDebugInfo(`Enhanced job preparation completed: ${result.stats.successful}/${result.stats.total} successful`);

    return result;
  }

  /**
   * Finalize prepared jobs by saving them to the database
   */
  async finalizeJobs(preparedResult: EnhancedJobCreationResult): Promise<EnhancedJobCreationResult> {
    this.logger.addDebugInfo(`Finalizing ${preparedResult.stats.total} prepared jobs`);

    const finalResult: EnhancedJobCreationResult = {
      ...preparedResult,
      createdJobs: [],
      stats: {
        ...preparedResult.stats,
        successful: 0,
        failed: 0,
        workflowsInitialized: 0
      }
    };

    // Now actually save each job to database
    for (const [woNo, assignment] of Object.entries(preparedResult.categoryAssignments)) {
      try {
        const job = preparedResult.failedJobs.length === 0 ? 
          { wo_no: woNo } : // We'll need to reconstruct the full job data
          null;
        
        if (job) {
          // Create the job in database using the prepared data
          await this.finalizeIndividualJob(woNo, assignment, preparedResult, finalResult);
          finalResult.stats.successful++;
          finalResult.stats.workflowsInitialized++;
        }
      } catch (error) {
        this.logger.addDebugInfo(`Failed to finalize job ${woNo}: ${error}`);
        finalResult.stats.failed++;
      }
    }

    this.logger.addDebugInfo(`Job finalization completed: ${finalResult.stats.successful}/${finalResult.stats.total} jobs saved`);

    return finalResult;
  }

  /**
   * Enhanced method that includes Excel data for better row mapping
   */
  async createEnhancedJobsWithExcelData(
    jobs: ParsedJob[], 
    headers: string[], 
    dataRows: any[][]
  ): Promise<EnhancedJobCreationResult> {
    this.logger.addDebugInfo(`Creating enhanced jobs for ${jobs.length} parsed jobs with Excel data`);
    this.logger.addDebugInfo(`Excel headers: ${JSON.stringify(headers)}`);
    this.logger.addDebugInfo(`Excel data rows: ${dataRows.length}`);

    const result: EnhancedJobCreationResult = {
      success: true,
      createdJobs: [],
      failedJobs: [],
      categoryAssignments: {},
      rowMappings: {},
      stats: {
        total: jobs.length,
        successful: 0,
        failed: 0,
        newCategories: 0,
        workflowsInitialized: 0
      }
    };

    // Process each job individually for better error handling
    for (let i = 0; i < jobs.length; i++) {
      try {
        await this.processJobWithExcelData(jobs[i], result, headers, dataRows[i] || []);
        result.stats.successful++;
      } catch (error) {
        this.logger.addDebugInfo(`Failed to process job ${jobs[i].wo_no}: ${error}`);
        result.failedJobs.push({
          job: jobs[i],
          error: error instanceof Error ? error.message : String(error)
        });
        result.stats.failed++;
      }
    }

    result.success = result.stats.failed === 0;
    this.logger.addDebugInfo(`Enhanced job creation completed: ${result.stats.successful}/${result.stats.total} successful`);

    return result;
  }

  private async processJob(job: ParsedJob, result: EnhancedJobCreationResult): Promise<void> {
    // Call the new method with empty arrays for backwards compatibility
    return this.processJobWithExcelData(job, result, [], []);
  }

  private async prepareJobWithExcelData(
    job: ParsedJob, 
    result: EnhancedJobCreationResult, 
    headers: string[], 
    excelRow: any[]
  ): Promise<void> {
    this.logger.addDebugInfo(`Preparing job: ${job.wo_no} with Excel data`);
    this.logger.addDebugInfo(`Job specifications - printing: ${JSON.stringify(job.printing_specifications)}`);
    this.logger.addDebugInfo(`Job specifications - finishing: ${JSON.stringify(job.finishing_specifications)}`);
    this.logger.addDebugInfo(`Job specifications - prepress: ${JSON.stringify(job.prepress_specifications)}`);
    
    // Use the preserved Excel row data from parsing if available, otherwise fallback to provided excelRow
    const actualExcelRow = job._originalExcelRow || excelRow || [];
    const actualRowIndex = job._originalRowIndex || 0;
    
    this.logger.addDebugInfo(`Using preserved Excel row data: ${actualExcelRow.length} columns`);
    this.logger.addDebugInfo(`Original row index: ${actualRowIndex}`);
    this.logger.addDebugInfo(`Headers length: ${headers?.length || 0}`);

    // 1. Map specifications to production stages using enhanced mapper
    const mappedStages = this.enhancedStageMapper.mapGroupsToStagesIntelligent(
      job.printing_specifications,
      job.finishing_specifications,
      job.prepress_specifications
    );

    this.logger.addDebugInfo(`Mapped ${mappedStages.length} stages for job ${job.wo_no}`);

    // 2. Create detailed row mappings for UI display 
    let rowMappings: any[] = [];
    
    if (job.printing_specifications || job.finishing_specifications || job.prepress_specifications) {
      // Use the actual Excel row data for mapping instead of synthetic data
      this.logger.addDebugInfo(`Creating row mappings from group specifications for job ${job.wo_no}`);
      
      rowMappings = this.enhancedStageMapper.createIntelligentRowMappings(
        job.printing_specifications,
        job.finishing_specifications,
        job.prepress_specifications,
        [actualExcelRow], // Pass the actual Excel row as a single-row array
        headers || []
      );
    } else {
      // No group specifications found - create a simple row mapping from the job data itself
      this.logger.addDebugInfo(`No group specifications found for job ${job.wo_no}, creating single row mapping from job data`);
      
      rowMappings = await this.createSimpleRowMappingFromJob(job, actualExcelRow, actualRowIndex, headers);
    }

    this.logger.addDebugInfo(`Created ${rowMappings.length} row mappings for job ${job.wo_no}`);
    
    // Store row mappings for UI display (ensure it's always an array)
    result.rowMappings[job.wo_no] = rowMappings || [];

    // 3. All imported jobs use custom workflows - no category assignment
    result.categoryAssignments[job.wo_no] = {
      categoryId: null,
      categoryName: 'Custom Workflow',
      confidence: 100,
      mappedStages: mappedStages,
      requiresCustomWorkflow: true,
      originalJob: job // Store the original job for later use
    };

    this.logger.addDebugInfo(`Job ${job.wo_no} prepared with custom workflow mappings`);
  }

  private async finalizeIndividualJob(
    woNo: string, 
    assignment: any, 
    preparedResult: EnhancedJobCreationResult, 
    finalResult: EnhancedJobCreationResult
  ): Promise<void> {
    const originalJob = assignment.originalJob;
    if (!originalJob) {
      throw new Error(`No original job data found for ${woNo}`);
    }

    // 4. Create enhanced job data (no category)
    const enhancedJobData = await this.buildEnhancedJobData(originalJob, null);

    // 5. Insert job into database with conflict resolution
    let insertedJob;
    try {
      // First, try to insert as new job
      const { data: newJob, error: insertError } = await supabase
        .from('production_jobs')
        .insert(enhancedJobData)
        .select()
        .single();

      if (insertError) {
        // If conflict (job already exists), update instead
        if (insertError.code === '23505') { // Unique constraint violation
          this.logger.addDebugInfo(`Job ${woNo} already exists, updating...`);
          
          const { data: updatedJob, error: updateError } = await supabase
            .from('production_jobs')
            .update({
              ...enhancedJobData,
              updated_at: new Date().toISOString()
            })
            .eq('wo_no', woNo)
            .eq('user_id', this.userId)
            .select()
            .single();

          if (updateError) {
            throw new Error(`Failed to update existing job: ${updateError.message}`);
          }
          
          insertedJob = updatedJob;
        } else {
          throw new Error(`Database insertion failed: ${insertError.message}`);
        }
      } else {
        insertedJob = newJob;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown database error';
      throw new Error(`Job creation failed for ${woNo}: ${errorMsg}`);
    }

    // 6. Auto-create custom workflow from mapped stages
    await this.initializeCustomWorkflow(insertedJob, originalJob, finalResult);
    this.logger.addDebugInfo(`Job ${woNo} finalized with custom workflow`);

    // 7. Update QR codes with actual job ID
    if (this.generateQRCodes && insertedJob && insertedJob.qr_code_data) {
      try {
        await this.updateJobQRCode(insertedJob);
      } catch (qrError) {
        this.logger.addDebugInfo(`Warning: QR code update failed for ${woNo}: ${qrError}`);
        // Don't fail the entire job creation for QR code issues
      }
    }

    finalResult.createdJobs.push(insertedJob);
  }

  private async processJobWithExcelData(
    job: ParsedJob, 
    result: EnhancedJobCreationResult, 
    headers: string[], 
    excelRow: any[]
  ): Promise<void> {
    this.logger.addDebugInfo(`Processing job: ${job.wo_no} with Excel data`);
    this.logger.addDebugInfo(`Job specifications - printing: ${JSON.stringify(job.printing_specifications)}`);
    this.logger.addDebugInfo(`Job specifications - finishing: ${JSON.stringify(job.finishing_specifications)}`);
    this.logger.addDebugInfo(`Job specifications - prepress: ${JSON.stringify(job.prepress_specifications)}`);
    
    // Use the preserved Excel row data from parsing if available, otherwise fallback to provided excelRow
    const actualExcelRow = job._originalExcelRow || excelRow || [];
    const actualRowIndex = job._originalRowIndex || 0;
    
    this.logger.addDebugInfo(`Using preserved Excel row data: ${actualExcelRow.length} columns`);
    this.logger.addDebugInfo(`Original row index: ${actualRowIndex}`);
    this.logger.addDebugInfo(`Headers length: ${headers?.length || 0}`);

    // 1. Map specifications to production stages using enhanced mapper
    const mappedStages = this.enhancedStageMapper.mapGroupsToStagesIntelligent(
      job.printing_specifications,
      job.finishing_specifications,
      job.prepress_specifications
    );

    this.logger.addDebugInfo(`Mapped ${mappedStages.length} stages for job ${job.wo_no}`);

    // 2. Create detailed row mappings for UI display 
    let rowMappings: any[] = [];
    
    if (job.printing_specifications || job.finishing_specifications || job.prepress_specifications) {
      // Use the actual Excel row data for mapping instead of synthetic data
      this.logger.addDebugInfo(`Creating row mappings from group specifications for job ${job.wo_no}`);
      
      rowMappings = this.enhancedStageMapper.createIntelligentRowMappings(
        job.printing_specifications,
        job.finishing_specifications,
        job.prepress_specifications,
        [actualExcelRow], // Pass the actual Excel row as a single-row array
        headers || []
      );
    } else {
      // No group specifications found - create a simple row mapping from the job data itself
      this.logger.addDebugInfo(`No group specifications found for job ${job.wo_no}, creating single row mapping from job data`);
      
      rowMappings = await this.createSimpleRowMappingFromJob(job, actualExcelRow, actualRowIndex, headers);
    }

    this.logger.addDebugInfo(`Created ${rowMappings.length} row mappings for job ${job.wo_no}`);
    
    // Store row mappings for UI display (ensure it's always an array)
    result.rowMappings[job.wo_no] = rowMappings || [];

    // 3. All imported jobs use custom workflows - no category assignment
    result.categoryAssignments[job.wo_no] = {
      categoryId: null,
      categoryName: 'Custom Workflow',
      confidence: 100,
      mappedStages: mappedStages,
      requiresCustomWorkflow: true
    };

    // 4. Create enhanced job data (no category)
    const enhancedJobData = await this.buildEnhancedJobData(job, null);

    // 5. Insert job into database with conflict resolution
    let insertedJob;
    try {
      // First, try to insert as new job
      const { data: newJob, error: insertError } = await supabase
        .from('production_jobs')
        .insert(enhancedJobData)
        .select()
        .single();

      if (insertError) {
        // If conflict (job already exists), update instead
        if (insertError.code === '23505') { // Unique constraint violation
          this.logger.addDebugInfo(`Job ${job.wo_no} already exists, updating...`);
          
          const { data: updatedJob, error: updateError } = await supabase
            .from('production_jobs')
            .update({
              ...enhancedJobData,
              updated_at: new Date().toISOString()
            })
            .eq('wo_no', job.wo_no)
            .eq('user_id', this.userId)
            .select()
            .single();

          if (updateError) {
            throw new Error(`Failed to update existing job: ${updateError.message}`);
          }
          
          insertedJob = updatedJob;
        } else {
          throw new Error(`Database insertion failed: ${insertError.message}`);
        }
      } else {
        insertedJob = newJob;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown database error';
      throw new Error(`Job creation failed for ${job.wo_no}: ${errorMsg}`);
    }

    // 6. Auto-create custom workflow from mapped stages
    await this.initializeCustomWorkflow(insertedJob, job, result);
    this.logger.addDebugInfo(`Job ${job.wo_no} created with custom workflow`);
    result.stats.workflowsInitialized++;

    // 7. Update QR codes with actual job ID
    if (this.generateQRCodes && insertedJob && insertedJob.qr_code_data) {
      try {
        await this.updateJobQRCode(insertedJob);
      } catch (qrError) {
        this.logger.addDebugInfo(`Warning: QR code update failed for ${job.wo_no}: ${qrError}`);
        // Don't fail the entire job creation for QR code issues
      }
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
      
      // Workflow flags - all imported jobs use custom workflows
      has_custom_workflow: true
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

  private async initializeJobWorkflow(insertedJob: any, categoryId: string, originalJob: ParsedJob): Promise<void> {
    this.logger.addDebugInfo(`Initializing workflow for job ${insertedJob.id} with category ${categoryId}`);

    // Check if this is a cover/text book job
    if (originalJob.cover_text_detection?.isBookJob) {
      this.logger.addDebugInfo(`Detected book job - creating cover/text workflow`);
      
      const workflowResult = await this.coverTextService.createCoverTextWorkflow(
        insertedJob.id,
        originalJob,
        categoryId
      );

      if (!workflowResult.success) {
        throw new Error(`Failed to create cover/text workflow: ${workflowResult.error}`);
      }

      this.logger.addDebugInfo(`Cover/text workflow created successfully with dependency group: ${workflowResult.dependencyGroupId}`);
      return;
    }

    // Standard single-component workflow
    const { error } = await supabase.rpc('initialize_job_stages_auto', {
      p_job_id: insertedJob.id,
      p_job_table_name: 'production_jobs',
      p_category_id: categoryId
    });

    if (error) {
      throw new Error(`Failed to initialize workflow: ${error.message}`);
    }

    // Update stage instances with appropriate quantities based on operation_quantities
    await this.updateStageQuantities(insertedJob.id);
  }

  private async initializeCustomWorkflow(insertedJob: any, originalJob: ParsedJob, result: EnhancedJobCreationResult): Promise<void> {
    try {
      this.logger.addDebugInfo(`Initializing custom workflow for job ${originalJob.wo_no} (ID: ${insertedJob.id})`);
      
      // Use the row mappings already created in processJobWithExcelData
      const rowMappings = result.rowMappings[originalJob.wo_no] || [];
      
      this.logger.addDebugInfo(`Using ${rowMappings.length} existing row mappings for workflow initialization`);

      if (rowMappings.length === 0) {
        this.logger.addDebugInfo(`No stage mappings found for job ${originalJob.wo_no}, skipping workflow initialization`);
        return;
      }

      // Extract stage information from row mappings (supporting multi-instance)
      const stageIds: string[] = [];
      const stageOrders: number[] = [];
      
      rowMappings
        .filter(mapping => !mapping.isUnmapped && mapping.mappedStageId)
        .forEach((mapping, index) => {
          stageIds.push(mapping.mappedStageId!);
          stageOrders.push(index + 1);
          this.logger.addDebugInfo(`Adding stage: ${mapping.mappedStageName} (${mapping.mappedStageSpecName || 'no sub-spec'}) - Instance: ${mapping.instanceId}`);
        });

      if (stageIds.length === 0) {
        this.logger.addDebugInfo(`No valid stage mappings for job ${originalJob.wo_no}, skipping workflow initialization`);
        return;
      }

      // Initialize custom workflow using the RPC function
      const { error: workflowError } = await supabase.rpc('initialize_custom_job_stages', {
        p_job_id: insertedJob.id,
        p_job_table_name: 'production_jobs',
        p_stage_ids: stageIds,
        p_stage_orders: stageOrders
      });

      if (workflowError) {
        this.logger.addDebugInfo(`Workflow initialization failed for ${originalJob.wo_no}: ${workflowError.message}`);
        throw new Error(`Workflow initialization failed: ${workflowError.message}`);
      }

      // Update stage instances with sub-specifications and quantities
      await this.updateStageInstancesWithSpecs(insertedJob.id, rowMappings);

      // Calculate and set due date based on stage durations
      await this.calculateAndSetDueDate(insertedJob.id, originalJob);

      this.logger.addDebugInfo(`Custom workflow initialized for ${originalJob.wo_no} with ${stageIds.length} stages (including multi-instance stages)`);
      
      // Verify stages were actually created by querying the database
      const { data: createdStages, error: verifyError } = await supabase
        .from('job_stage_instances')
        .select('id, production_stage_id, status')
        .eq('job_id', insertedJob.id)
        .eq('job_table_name', 'production_jobs');

      if (verifyError) {
        this.logger.addDebugInfo(`Error verifying created stages: ${verifyError.message}`);
      } else {
        this.logger.addDebugInfo(`Verification: ${createdStages?.length || 0} stages actually created in database`);
      }
      
    } catch (error) {
      this.logger.addDebugInfo(`Custom workflow initialization error for ${originalJob.wo_no}: ${error}`);
      throw error; // Re-throw to ensure errors are visible in the UI
    }
  }

  /**
   * Build Excel rows structure from job specifications for row mapping
   */
  private buildExcelRowsFromSpecifications(
    job: ParsedJob,
    headers: string[],
    originalExcelRow: any[]
  ): any[][] {
    const excelRows: any[][] = [];
    let currentRowIndex = 0;

    // Process printing specifications
    if (job.printing_specifications) {
      for (const [groupName, spec] of Object.entries(job.printing_specifications)) {
        const row = this.createExcelRowFromSpec(groupName, spec, headers, originalExcelRow, currentRowIndex);
        excelRows.push(row);
        currentRowIndex++;
      }
    }

    // Process finishing specifications
    if (job.finishing_specifications) {
      for (const [groupName, spec] of Object.entries(job.finishing_specifications)) {
        const row = this.createExcelRowFromSpec(groupName, spec, headers, originalExcelRow, currentRowIndex);
        excelRows.push(row);
        currentRowIndex++;
      }
    }

    // Process prepress specifications
    if (job.prepress_specifications) {
      for (const [groupName, spec] of Object.entries(job.prepress_specifications)) {
        const row = this.createExcelRowFromSpec(groupName, spec, headers, originalExcelRow, currentRowIndex);
        excelRows.push(row);
        currentRowIndex++;
      }
    }

    this.logger.addDebugInfo(`Built ${excelRows.length} Excel rows from specifications for job ${job.wo_no}`);
    return excelRows;
  }

  /**
   * Create an Excel row from a specification group
   */
  private createExcelRowFromSpec(
    groupName: string,
    spec: any,
    headers: string[],
    originalExcelRow: any[],
    rowIndex: number
  ): any[] {
    // Create a row array with the same length as headers
    const row = new Array(headers.length).fill('');
    
    // Try to populate with original Excel data if available
    if (originalExcelRow && originalExcelRow.length > 0) {
      for (let i = 0; i < Math.min(row.length, originalExcelRow.length); i++) {
        row[i] = originalExcelRow[i] || '';
      }
    }
    
    // Always include the group name and description for mapping
    row[0] = groupName; // First column is usually the operation/group name
    if (spec.description && headers.length > 1) {
      row[1] = spec.description; // Second column for description
    }
    if (spec.qty && headers.length > 2) {
      row[2] = spec.qty; // Third column for quantity
    }
    
    return row;
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

  private async calculateAndSetDueDate(jobId: string, originalJob: ParsedJob): Promise<void> {
    try {
      // Get all stages with their durations
      const { data: stages, error } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          quantity,
          production_stages(
            running_speed_per_hour,
            make_ready_time_minutes,
            speed_unit
          )
        `)
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs');

      if (error || !stages) return;

      let totalMinutes = 0;
      
      // Calculate total estimated duration
      for (const stage of stages) {
        const productionStage = stage.production_stages as any;
        if (productionStage && stage.quantity) {
          const duration = await this.calculateStageEstimateWithQuantityType(
            stage.quantity,
            productionStage.running_speed_per_hour || 100,
            productionStage.make_ready_time_minutes || 10,
            productionStage.speed_unit || 'sheets_per_hour',
            'pieces'
          );
          totalMinutes += duration;
        }
      }

      // Convert to days and add buffer
      const estimatedDays = Math.ceil(totalMinutes / (8 * 60)) + 1; // 8 hour work days + 1 day buffer
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + estimatedDays);

      // Update job with calculated due date
      await supabase
        .from('production_jobs')
        .update({ 
          due_date: dueDate.toISOString().split('T')[0],
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      this.logger.addDebugInfo(`Due date calculated for ${originalJob.wo_no}: ${estimatedDays} days from now`);
      
    } catch (error) {
      this.logger.addDebugInfo(`Due date calculation failed: ${error}`);
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

  /**
   * Update stage instances with sub-specifications and quantities from row mappings
   */
  private async updateStageInstancesWithSpecs(jobId: string, rowMappings: any[]): Promise<void> {
    try {
      // Get all created stage instances for this job
      const { data: stageInstances, error: stagesError } = await supabase
        .from('job_stage_instances')
        .select('id, production_stage_id, stage_order')
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs')
        .order('stage_order');

      if (stagesError || !stageInstances) {
        this.logger.addDebugInfo('No stage instances found for specification updates');
        return;
      }

      // Match row mappings to stage instances and update with specifications
      for (let i = 0; i < stageInstances.length && i < rowMappings.length; i++) {
        const stageInstance = stageInstances[i];
        const mapping = rowMappings.filter(m => !m.isUnmapped && m.mappedStageId)[i];
        
        if (!mapping) continue;

        const updateData: any = {
          quantity: mapping.qty || mapping.woQty || 0,
          updated_at: new Date().toISOString()
        };

        // Add stage specification if available
        if (mapping.mappedStageSpecId) {
          updateData.stage_specification_id = mapping.mappedStageSpecId;
        }

        // Add notes about the mapping
        const notes = [];
        if (mapping.mappedStageSpecName) {
          notes.push(`Sub-specification: ${mapping.mappedStageSpecName}`);
        }
        if (mapping.paperSpecification) {
          notes.push(`Paper: ${mapping.paperSpecification}`);
        }
        if (mapping.instanceId) {
          notes.push(`Instance: ${mapping.instanceId}`);
        }
        
        if (notes.length > 0) {
          updateData.notes = notes.join(' | ');
        }

        await supabase
          .from('job_stage_instances')
          .update(updateData)
          .eq('id', stageInstance.id);

        this.logger.addDebugInfo(`Updated stage instance ${stageInstance.id} with specification: ${mapping.mappedStageSpecName || 'none'}`);
      }
    } catch (error) {
      this.logger.addDebugInfo(`Failed to update stage instances with specifications: ${error}`);
    }
  }


  /**
   * Get a default stage mapping for standard Excel imports
   */
  private async getDefaultStageMapping(job: ParsedJob): Promise<{ stageId: string; stageName: string } | null> {
    try {
      // For standard Excel imports, try to map to common stages
      // Load production stages directly since mapper doesn't expose them
      const { data: stages, error } = await supabase
        .from('production_stages')
        .select('id, name')
        .eq('is_active', true)
        .order('order_index');
      
      if (error || !stages?.length) {
        this.logger.addDebugInfo(`No production stages available: ${error?.message || 'No stages found'}`);
        return null;
      }
      
      // Try to find a "Printing" or "Digital Print" stage
      const printingStage = stages.find(stage => 
        stage.name.toLowerCase().includes('print') || 
        stage.name.toLowerCase().includes('digital')
      );
      
      if (printingStage) {
        this.logger.addDebugInfo(`Found default printing stage: ${printingStage.name} for job ${job.wo_no}`);
        return {
          stageId: printingStage.id,
          stageName: printingStage.name
        };
      }
      
      // Fallback to the first available stage
      this.logger.addDebugInfo(`Using fallback stage: ${stages[0].name} for job ${job.wo_no}`);
      return {
        stageId: stages[0].id,
        stageName: stages[0].name
      };
      
    } catch (error) {
      this.logger.addDebugInfo(`Error getting default stage mapping: ${error}`);
      return null;
    }
  }

  private async createSimpleRowMappingFromJob(job: ParsedJob, excelRow: any[], rowIndex: number, headers: string[]): Promise<RowMappingResult[]> {
    // Create a single row mapping representing this job when no group specifications exist
    this.logger.addDebugInfo(`Creating simple row mapping for job ${job.wo_no} from Excel row data`);
    this.logger.addDebugInfo(`Excel row: ${JSON.stringify(excelRow)}`);
    this.logger.addDebugInfo(`Headers: ${JSON.stringify(headers)}`);
    
    // Get default stages for common workflow
    const availableStages = await this.getDefaultStages();
    this.logger.addDebugInfo(`Found ${availableStages.length} default stages`);
    
    const mappings: RowMappingResult[] = [];
    
    // Create a mapping for each default stage
    availableStages.forEach((stage, index) => {
      const mapping: RowMappingResult = {
        excelRowIndex: rowIndex,
        excelData: excelRow || [],
        groupName: `Stage ${index + 1}`,
        description: `${stage.name} - ${job.customer || 'Unknown Customer'}`,
        qty: job.qty || 0,
        woQty: job.qty || 0,
        mappedStageId: stage.id,
        mappedStageName: stage.name,
        mappedStageSpecId: null,
        mappedStageSpecName: null,
        confidence: 80,
        category: this.getCategoryFromStage(stage.name),
        isUnmapped: false,
        instanceId: `job-${job.wo_no}-stage-${index}`
      };
      mappings.push(mapping);
    });

    this.logger.addDebugInfo(`Created ${mappings.length} simple row mappings for job ${job.wo_no}`);
    return mappings;
  }

  private async getDefaultStages(): Promise<any[]> {
    // Get a basic set of production stages for custom workflows
    const { data: stages, error } = await supabase
      .from('production_stages')
      .select('id, name, order_index')
      .eq('is_active', true)
      .order('order_index')
      .limit(4); // Get first 4 stages as default

    if (error) {
      this.logger.addDebugInfo(`Error fetching default stages: ${error.message}`);
      return [];
    }

    this.logger.addDebugInfo(`Retrieved ${stages?.length || 0} default stages`);
    return stages || [];
  }

  private getCategoryFromStage(stageName: string): 'printing' | 'finishing' | 'prepress' | 'delivery' | 'unknown' {
    const name = stageName.toLowerCase();
    if (name.includes('print') || name.includes('digital') || name.includes('litho')) {
      return 'printing';
    }
    if (name.includes('finish') || name.includes('cut') || name.includes('fold') || name.includes('bind')) {
      return 'finishing';
    }
    if (name.includes('prepress') || name.includes('artwork') || name.includes('proof')) {
      return 'prepress';
    }
    if (name.includes('delivery') || name.includes('dispatch')) {
      return 'delivery';
    }
    return 'unknown';
  }
}