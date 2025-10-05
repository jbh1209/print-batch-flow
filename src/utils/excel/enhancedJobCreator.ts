import type { ParsedJob, RowMappingResult, GroupSpecifications } from './types';
import type { ExcelImportDebugger } from './debugger';
import { ProductionStageMapper, type CategoryAssignmentResult } from './productionStageMapper';
import { EnhancedStageMapper } from './enhancedStageMapper';
import { supabase } from '@/integrations/supabase/client';
import { generateQRCodeData, generateQRCodeImage } from '@/utils/qrCodeGenerator';
import { CoverTextWorkflowService } from '@/services/coverTextWorkflowService';
import { TimingCalculationService } from '@/services/timingCalculationService';
import { initializeJobWorkflow } from '@/utils/jobWorkflowInitializer';
// ProductionScheduler removed - now using DynamicDueDateService for workload-aware scheduling

export interface EnhancedJobCreationResult {
  success: boolean;
  createdJobs: any[];
  failedJobs: { job: ParsedJob; error: string }[];
  categoryAssignments: { [woNo: string]: CategoryAssignmentResult };
  duplicatesSkipped?: number;
  duplicateJobs?: any[];
  rowMappings: { [woNo: string]: RowMappingResult[] };
  userApprovedStageMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>;
  userId?: string;
  generateQRCodes?: boolean;
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
    dataRows: any[][],
    userApprovedStageMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
  ): Promise<EnhancedJobCreationResult> {
    this.logger.addDebugInfo(`Preparing enhanced jobs for ${jobs.length} parsed jobs with Excel data`);
    this.logger.addDebugInfo(`Excel headers: ${JSON.stringify(headers)}`);
    this.logger.addDebugInfo(`Excel data rows: ${dataRows.length}`);
    
    // CRITICAL FIX: Log user-approved stage mappings being preserved
    if (userApprovedStageMappings && userApprovedStageMappings.length > 0) {
      this.logger.addDebugInfo(`🎯 PREPARE JOBS - PRESERVING USER-APPROVED STAGE MAPPINGS: ${userApprovedStageMappings.length} mappings`);
      userApprovedStageMappings.forEach((mapping) => {
        this.logger.addDebugInfo(`   - Group "${mapping.groupName}" -> Stage ${mapping.mappedStageId} (${mapping.mappedStageName}) [${mapping.category}]`);
      });
    } else {
      this.logger.addDebugInfo(`❌ NO USER-APPROVED STAGE MAPPINGS RECEIVED IN PREPARE PHASE`);
    }

    const result: EnhancedJobCreationResult = {
      success: true,
      createdJobs: [],
      failedJobs: [],
      categoryAssignments: {},
      rowMappings: {},
      userId: this.userId,
      generateQRCodes: this.generateQRCodes,
      userApprovedStageMappings: userApprovedStageMappings, // CRITICAL: Preserve user mappings
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
   * Finalize prepared jobs by saving them to the database - SERIALIZED VERSION
   */
  async finalizeJobs(preparedResult: EnhancedJobCreationResult, userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>): Promise<EnhancedJobCreationResult> {
    this.logger.addDebugInfo(`🔄 Finalizing ${preparedResult.stats.total} prepared jobs SERIALLY to avoid concurrency issues`);

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

    // CRITICAL: Process jobs ONE AT A TIME to avoid constraint violations
    const jobEntries = Object.entries(preparedResult.categoryAssignments);
    for (let i = 0; i < jobEntries.length; i++) {
      const [woNo, assignment] = jobEntries[i];
      
      this.logger.addDebugInfo(`📋 Processing job ${i + 1}/${jobEntries.length}: ${woNo}`);
      
      try {
        // Use the original job stored in the assignment
        if (assignment.originalJob) {
          // Create the job in database using the prepared data
          await this.finalizeIndividualJob(woNo, assignment, preparedResult, finalResult, userApprovedMappings);
          finalResult.stats.successful++;
          finalResult.stats.workflowsInitialized++;
          this.logger.addDebugInfo(`✅ Successfully processed job ${woNo}`);
        } else {
          this.logger.addDebugInfo(`❌ No original job data found for ${woNo}, skipping`);
          finalResult.stats.failed++;
          finalResult.failedJobs.push({
            job: assignment.originalJob || { wo_no: woNo } as any,
            error: 'No original job data found'
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.addDebugInfo(`❌ Failed to finalize job ${woNo}: ${errorMessage}`);
        finalResult.stats.failed++;
        finalResult.failedJobs.push({
          job: assignment.originalJob || { wo_no: woNo } as any,
          error: errorMessage
        });
      }
      
      // Add small delay between jobs to reduce database load
      if (i < jobEntries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.logger.addDebugInfo(`🏁 Job finalization completed: ${finalResult.stats.successful}/${finalResult.stats.total} jobs saved`);

    return finalResult;
  }

  /**
   * Enhanced method that includes Excel data for better row mapping
   */
  async createEnhancedJobsWithExcelData(
    jobs: ParsedJob[], 
    headers: string[], 
    dataRows: any[][],
    userApprovedStageMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
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

    // Store user-approved stage mappings in result for later use
    result.userApprovedStageMappings = userApprovedStageMappings;
    
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

  private async prepareJobWithExcelData(
    job: ParsedJob, 
    result: EnhancedJobCreationResult, 
    headers: string[], 
    excelRow: any[]
  ): Promise<void> {
    this.logger.addDebugInfo(`Preparing job: ${job.wo_no} with Excel data`);
    
    // Use the preserved Excel row data from parsing if available, otherwise fallback to provided excelRow
    const actualExcelRow = job._originalExcelRow || excelRow || [];
    const actualRowIndex = job._originalRowIndex || 0;
    
    this.logger.addDebugInfo(`Using preserved Excel row data: ${actualExcelRow.length} columns`);

    // 1. Map specifications to production stages using enhanced mapper with user-approved mappings
    const userApprovedMappings = this.extractUserApprovedMappings(job);
    
    // CRITICAL FIX: Convert job.paper_specifications to GroupSpecifications format for stage mapper
    const paperSpecsForMapping = this.convertPaperSpecsToGroupFormat(job.paper_specifications);
    
    const mappedStages = this.enhancedStageMapper.mapGroupsToStagesIntelligent(
      job.printing_specifications,
      job.finishing_specifications,
      job.prepress_specifications,
      userApprovedMappings,
      paperSpecsForMapping,  // Pass converted paper specifications
      job.packaging_specifications,  // Pass packaging specifications
      job.delivery_specifications   // Pass delivery specifications
    );

    this.logger.addDebugInfo(`Mapped ${mappedStages.length} stages for job ${job.wo_no}`);

    // 2. Create detailed row mappings for UI display 
    let rowMappings: any[] = [];
    
    if (job.printing_specifications || job.finishing_specifications || job.prepress_specifications || job.packaging_specifications || job.delivery_specifications) {
      // Use the actual Excel row data for mapping instead of synthetic data
      this.logger.addDebugInfo(`Creating row mappings from group specifications for job ${job.wo_no}`);
      
      rowMappings = this.enhancedStageMapper.createIntelligentRowMappings(
        job.printing_specifications,
        job.finishing_specifications,
        job.prepress_specifications,
        [actualExcelRow], // Pass the actual Excel row as a single-row array
        headers || [],
        job.paper_specifications,
        job.packaging_specifications,  // Pass packaging specifications
        job.delivery_specifications   // Pass delivery specifications
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

  /**
   * Convert job.paper_specifications to GroupSpecifications format for enhanced stage mapper
   */
  private convertPaperSpecsToGroupFormat(paperSpecs: any): GroupSpecifications | null {
    if (!paperSpecs) return null;
    
    const converted: GroupSpecifications = {};
    
    // Check if it's already in group format or needs conversion
    if (paperSpecs.parsed_paper) {
      // Coming from enhanced mapping processor
      converted.parsed_paper = {
        description: `${paperSpecs.parsed_paper.type || ''} ${paperSpecs.parsed_paper.weight || ''}`.trim(),
        specifications: paperSpecs.parsed_paper.original_text || '',
        qty: 1,
        paperType: paperSpecs.parsed_paper.type,
        paperWeight: paperSpecs.parsed_paper.weight,
        color: paperSpecs.parsed_paper.color,
        size: paperSpecs.parsed_paper.size,
        finish: paperSpecs.parsed_paper.finish
      };
    } else {
      // Convert any other paper spec format
      Object.entries(paperSpecs).forEach(([key, value]: [string, any]) => {
        if (value && typeof value === 'object') {
          converted[key] = {
            description: value.description || value.type || '',
            specifications: value.specifications || value.original_text || '',
            qty: value.qty || 1,
            ...value  // Preserve all other properties
          };
        }
      });
    }
    
    this.logger.addDebugInfo(`🔄 PAPER SPECS CONVERSION: ${Object.keys(paperSpecs).join(', ')} -> ${Object.keys(converted).join(', ')}`);
    return Object.keys(converted).length > 0 ? converted : null;
  }


  private async finalizeIndividualJob(
    woNo: string, 
    assignment: any, 
    preparedResult: EnhancedJobCreationResult, 
    finalResult: EnhancedJobCreationResult,
    userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>,
    maxRetries: number = 3
  ): Promise<void> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.addDebugInfo(`🔄 Attempt ${attempt}/${maxRetries} for job ${woNo}`);
        
        await this.processIndividualJobInDatabase(woNo, assignment, preparedResult, finalResult, userApprovedMappings);
        
        this.logger.addDebugInfo(`✅ Successfully processed job ${woNo} on attempt ${attempt}`);
        return; // Success - exit retry loop
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.addDebugInfo(`❌ Attempt ${attempt}/${maxRetries} failed for job ${woNo}: ${lastError.message}`);
        
        // Check if it's a constraint violation that might resolve with retry
        if (lastError.message.includes('unique constraint') || 
            lastError.message.includes('duplicate key')) {
          
          if (attempt < maxRetries) {
            // Wait with exponential backoff before retrying
            const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            this.logger.addDebugInfo(`⏱️ Waiting ${delayMs}ms before retry ${attempt + 1}`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
          }
        } else {
          // Non-retryable error - throw immediately
          throw lastError;
        }
      }
    }
    
    // All retries exhausted
    throw new Error(`Failed to process job ${woNo} after ${maxRetries} attempts: ${lastError?.message}`);
  }

  private async processIndividualJobInDatabase(
    woNo: string, 
    assignment: any, 
    preparedResult: EnhancedJobCreationResult, 
    finalResult: EnhancedJobCreationResult,
    userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
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

    // 6. Initialize workflow using the new unified workflow initializer
    try {
      this.logger.addDebugInfo(`🚀 Initializing workflow for job ${woNo} (${insertedJob.id})`);
      this.logger.addDebugInfo(`📋 Available user-approved mappings: ${(userApprovedMappings || []).length}`);
      this.logger.addDebugInfo(`📂 Category ID: ${assignment.categoryId}`);
      
      const success = await initializeJobWorkflow(
        insertedJob.id,
        userApprovedMappings || [], // Pass ALL user-approved mappings
        assignment.categoryId,
        this.logger
      );

      if (!success) {
        throw new Error('Workflow initialization failed');
      }

      this.logger.addDebugInfo(`✅ Workflow initialized for job ${woNo}`);
      
      // ✅ RESTORED: Calculate timing for job stages to get quantities right
      await this.calculateTimingForJob(insertedJob.id, userApprovedMappings, originalJob, woNo);
      
      // 🚀 SIMPLE DUE DATE: Set immediate due date using simple calculation
      await this.setSimpleDueDate(insertedJob.id, woNo);
      
    } catch (error) {
      this.logger.addDebugInfo(`Workflow initialization error for ${originalJob.wo_no}: ${error}`);
      throw error;
    }

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
    
    // Use the preserved Excel row data from parsing if available, otherwise fallback to provided excelRow
    const actualExcelRow = job._originalExcelRow || excelRow || [];
    const actualRowIndex = job._originalRowIndex || 0;
    
    this.logger.addDebugInfo(`Using preserved Excel row data: ${actualExcelRow.length} columns`);

    // 1. Map specifications to production stages using enhanced mapper with user-approved mappings
    const userApprovedMappings = this.extractUserApprovedMappings(job);
    this.logger.addDebugInfo(`🔍 EXTRACTED ${userApprovedMappings.length} USER MAPPINGS during job processing:`);
    userApprovedMappings.forEach(mapping => {
      this.logger.addDebugInfo(`   - ${mapping.groupName} -> ${mapping.mappedStageName} (${mapping.mappedStageId}) [${mapping.category}]`);
    });
    
    // CRITICAL FIX: Convert job.paper_specifications to GroupSpecifications format for stage mapper
    const paperSpecsForMapping = this.convertPaperSpecsToGroupFormat(job.paper_specifications);
    this.logger.addDebugInfo(`🎯 CONVERTED PAPER SPECS: ${JSON.stringify(paperSpecsForMapping)}`);
    
    const mappedStages = this.enhancedStageMapper.mapGroupsToStagesIntelligent(
      job.printing_specifications,
      job.finishing_specifications,
      job.prepress_specifications,
      userApprovedMappings,
      paperSpecsForMapping,  // Pass converted paper specifications  
      job.packaging_specifications,  // Pass packaging specifications
      job.delivery_specifications   // Pass delivery specifications
    );

    this.logger.addDebugInfo(`Mapped ${mappedStages.length} stages for job ${job.wo_no}`);

    // CRITICAL FIX: Store the resolved mapping data back into job specifications
    // This ensures that extractUserApprovedMappings can find the stage specification IDs
    this.storeMappingDataInJobSpecifications(job, mappedStages);

    // 2. Create detailed row mappings for UI display 
    let rowMappings: any[] = [];
    
    if (job.printing_specifications || job.finishing_specifications || job.prepress_specifications || job.packaging_specifications || job.delivery_specifications) {
      // Use the actual Excel row data for mapping instead of synthetic data
      this.logger.addDebugInfo(`Creating row mappings from group specifications for job ${job.wo_no}`);
      
      rowMappings = this.enhancedStageMapper.createIntelligentRowMappings(
        job.printing_specifications,
        job.finishing_specifications,
        job.prepress_specifications,
        [actualExcelRow], // Pass the actual Excel row as a single-row array
        headers || [],
        job.paper_specifications,
        job.packaging_specifications,  // Pass packaging specifications
        job.delivery_specifications   // Pass delivery specifications
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

    // 6. Initialize workflow using the new unified workflow initializer
    try {
      this.logger.addDebugInfo(`🚀 Initializing workflow for enhanced job ${job.wo_no} (${insertedJob.id})`);
      this.logger.addDebugInfo(`📋 Available user-approved stage mappings: ${(result.userApprovedStageMappings || []).length}`);
      
      const success = await initializeJobWorkflow(
        insertedJob.id,
        result.userApprovedStageMappings || [], // Pass ALL user-approved mappings
        null, // No category for enhanced jobs
        this.logger
      );

      if (!success) {
        throw new Error('Workflow initialization failed');
      }

      result.stats.workflowsInitialized++;
      this.logger.addDebugInfo(`✅ Workflow initialized for job ${job.wo_no}`);
      
      // ✅ RESTORED: Calculate timing for job stages to get quantities right
      await this.calculateTimingForJob(insertedJob.id, this.extractUserApprovedMappings(job), job, job.wo_no);
      
      // 🚀 SIMPLE DUE DATE: Set immediate due date using simple calculation
      await this.setSimpleDueDate(insertedJob.id, job.wo_no);
      
    } catch (error) {
      this.logger.addDebugInfo(`Workflow initialization error for ${job.wo_no}: ${error}`);
      throw error;
    }

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
  }

  private extractUserApprovedMappings(job: ParsedJob): Array<{groupName: string, mappedStageId: string, mappedStageName: string, mappedStageSpecId?: string, mappedStageSpecName?: string, category: string}> {
    const mappings: Array<{groupName: string, mappedStageId: string, mappedStageName: string, mappedStageSpecId?: string, mappedStageSpecName?: string, category: string}> = [];
    
    // Extract from printing specifications
    if (job.printing_specifications) {
      Object.entries(job.printing_specifications).forEach(([groupName, spec]: [string, any]) => {
        if (spec && spec.mappedStageId && spec.mappedStageName) {
          mappings.push({
            groupName,
            mappedStageId: spec.mappedStageId,
            mappedStageName: spec.mappedStageName,
            mappedStageSpecId: spec.mappedStageSpecId || null,
            mappedStageSpecName: spec.mappedStageSpecName || null,
            category: 'printing'
          });
        } else if (spec && spec.description) {
          // FALLBACK: Try to resolve mapping from database if not already stored
          const resolvedMapping = this.resolveMappingFromDatabase(spec.description, 'printing');
          if (resolvedMapping) {
            mappings.push({
              groupName,
              mappedStageId: resolvedMapping.stageId,
              mappedStageName: resolvedMapping.stageName,
              mappedStageSpecId: resolvedMapping.stageSpecId || null,
              mappedStageSpecName: resolvedMapping.stageSpecName || null,
              category: 'printing'
            });
          }
        }
      });
    }
    
    // Extract from finishing specifications
    if (job.finishing_specifications) {
      Object.entries(job.finishing_specifications).forEach(([groupName, spec]: [string, any]) => {
        if (spec && spec.mappedStageId && spec.mappedStageName) {
          mappings.push({
            groupName,
            mappedStageId: spec.mappedStageId,
            mappedStageName: spec.mappedStageName,
            mappedStageSpecId: spec.mappedStageSpecId || null,
            mappedStageSpecName: spec.mappedStageSpecName || null,
            category: 'finishing'
          });
        }
      });
    }
    
    // Extract from prepress specifications
    if (job.prepress_specifications) {
      Object.entries(job.prepress_specifications).forEach(([groupName, spec]: [string, any]) => {
        if (spec && spec.mappedStageId && spec.mappedStageName) {
          mappings.push({
            groupName,
            mappedStageId: spec.mappedStageId,
            mappedStageName: spec.mappedStageName,
            mappedStageSpecId: spec.mappedStageSpecId || null,
            mappedStageSpecName: spec.mappedStageSpecName || null,
            category: 'prepress'
          });
        }
      });
    }
    
    // Extract from packaging specifications
    if (job.packaging_specifications) {
      Object.entries(job.packaging_specifications).forEach(([groupName, spec]: [string, any]) => {
        if (spec && spec.mappedStageId && spec.mappedStageName) {
          mappings.push({
            groupName,
            mappedStageId: spec.mappedStageId,
            mappedStageName: spec.mappedStageName,
            mappedStageSpecId: spec.mappedStageSpecId || null,
            mappedStageSpecName: spec.mappedStageSpecName || null,
            category: 'packaging'
          });
        }
      });
    }
    
    return mappings;
  }

  private async createSimpleRowMappingFromJob(
    job: ParsedJob, 
    excelRow: any[], 
    rowIndex: number,
    headers: string[]
  ): Promise<RowMappingResult[]> {
    this.logger.addDebugInfo(`Creating simple row mapping for job ${job.wo_no} from job data`);
    
    // Create a single row mapping that represents the entire job
    const rowMapping: RowMappingResult = {
      excelRowIndex: rowIndex,
      excelData: excelRow,
      groupName: job.wo_no || 'Unknown Job',
      description: job.specification || job.reference || 'No description available',
      qty: job.qty || 1,
      woQty: job.qty || 1,
      confidence: 50, // Medium confidence since we're inferring
      mappedStageId: null,
      mappedStageName: null,
      mappedStageSpecId: null,
      mappedStageSpecName: null,
      isUnmapped: true,
      category: 'unknown'
    };

    return [rowMapping];
  }

  private async buildEnhancedJobData(job: ParsedJob, categoryId: string | null): Promise<any> {
    this.logger.addDebugInfo(`Building enhanced job data for ${job.wo_no}`);

    // Calculate due date if not provided using SLA target days
    let calculatedDueDate = job.due_date;
    if (!calculatedDueDate) {
      try {
        // Get SLA target days from app settings (default to 3 days)
        const { data: slaSettings } = await supabase
          .from('app_settings')
          .select('sla_target_days')
          .eq('setting_type', 'default')
          .eq('product_type', 'production_jobs')
          .single();
        
        const slaTargetDays = slaSettings?.sla_target_days || 3;
        const today = new Date();
        const dueDate = await this.addWorkingDays(today, slaTargetDays);
        calculatedDueDate = dueDate.toISOString().split('T')[0];
        
        this.logger.addDebugInfo(`Calculated due date for ${job.wo_no}: ${calculatedDueDate} (${slaTargetDays} working days)`);
      } catch (error) {
        this.logger.addDebugInfo(`Failed to calculate due date for ${job.wo_no}, using default 3 days: ${error}`);
        const today = new Date();
        today.setDate(today.getDate() + 3);
        calculatedDueDate = today.toISOString().split('T')[0];
      }
    }

    // Generate QR code data if enabled
    let qrCodeData = null;
    let qrCodeUrl = null;
    
    if (this.generateQRCodes) {
      try {
        // Generate temporary QR code data (will be updated with real job ID later)
        const tempQrData = generateQRCodeData({
          wo_no: job.wo_no,
          job_id: 'temp',
          customer: job.customer || '',
          due_date: job.due_date || new Date().toISOString().split('T')[0]
        });
        
        qrCodeData = JSON.stringify(tempQrData);
        qrCodeUrl = await generateQRCodeImage(tempQrData);
        
        this.logger.addDebugInfo(`Generated QR code for ${job.wo_no}`);
      } catch (qrError) {
        this.logger.addDebugInfo(`QR code generation failed for ${job.wo_no}: ${qrError}`);
        // Don't fail job creation for QR code issues
      }
    }

    const enhancedData = {
      wo_no: job.wo_no,
      customer: job.customer,
      contact: job.contact,
      reference: job.reference,
      specification: job.specification,
      qty: job.qty,
      size: job.size,
      location: job.location,
      rep: job.rep,
      due_date: calculatedDueDate,
      date: job.date,
      user_id: this.userId,
      category_id: categoryId,
      status: 'pending',
      has_custom_workflow: categoryId === null, // Custom workflow if no category
      printing_specifications: job.printing_specifications || null,
      finishing_specifications: job.finishing_specifications || null,
      prepress_specifications: job.prepress_specifications || null,
      paper_specifications: job.paper_specifications || null,
      delivery_specifications: job.delivery_specifications || null,
      operation_quantities: job.operation_quantities || null,
      qr_code_data: qrCodeData,
      qr_code_url: qrCodeUrl,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.logger.addDebugInfo(`Enhanced job data built for ${job.wo_no}: ${Object.keys(enhancedData).length} fields`);
    return enhancedData;
  }

  private async updateJobQRCode(job: any): Promise<void> {
    if (!job.qr_code_data) return;

    try {
      // Parse existing QR data and update with real job ID
      const qrData = JSON.parse(job.qr_code_data);
      qrData.job_id = job.id;
      
      // Generate new QR code with updated data
      const updatedQrCodeData = JSON.stringify(qrData);
      const updatedQrCodeUrl = await generateQRCodeImage(qrData);

      // Update the job with new QR code
      const { error } = await supabase
        .from('production_jobs')
        .update({
          qr_code_data: updatedQrCodeData,
          qr_code_url: updatedQrCodeUrl
        })
        .eq('id', job.id);

      if (error) {
        throw new Error(`QR code update failed: ${error.message}`);
      }

    this.logger.addDebugInfo(`QR code updated for job ${job.wo_no} with real job ID`);
  } catch (error) {
    this.logger.addDebugInfo(`QR code update error for ${job.wo_no}: ${error}`);
    throw error;
  }
}

/**
 * ✅ RESTORED: Calculate timing for job stages to populate quantities correctly
 */
private async calculateTimingForJob(
  jobId: string,
  userApprovedMappings: Array<{groupName: string, mappedStageId: string, mappedStageName: string, mappedStageSpecId?: string, mappedStageSpecName?: string, category: string}> | undefined,
  originalJob: ParsedJob,
  woNo: string
): Promise<void> {
  try {
    this.logger.addDebugInfo(`🎯 Starting timing calculations for job ${woNo} (${jobId})`);
    
    // Fetch all stage instances for this job
    const { data: stageInstances, error } = await supabase
      .from('job_stage_instances')
      .select('id, production_stage_id, stage_specification_id, quantity, part_name, unique_stage_key')
      .eq('job_id', jobId)
      .eq('job_table_name', 'production_jobs');
    
    if (error) {
      this.logger.addDebugInfo(`❌ Failed to fetch stage instances for timing calculation: ${error.message}`);
      return;
    }
    
    if (!stageInstances || stageInstances.length === 0) {
      this.logger.addDebugInfo(`⚠️ No stage instances found for job ${woNo}, skipping timing calculation`);
      return;
    }
    
    // Create a map of stage IDs to quantities from user mappings and original job
    const quantityMap = new Map<string, number>();
    
    // Add quantities from user mappings - these should contain the parsed Excel quantities
    if (userApprovedMappings) {
    // Track stage ID occurrences to generate unique keys
    const stageIdCounts = new Map<string, number>();
  
    userApprovedMappings.forEach(mapping => {
    this.logger.addDebugInfo(`🔍 Processing mapping for group: ${mapping.groupName}`);
    
    // First try to extract quantity from job specifications based on groupName
    let qty = this.extractQuantityFromJobSpecs(originalJob, mapping.groupName);
    
    this.logger.addDebugInfo(`📊 Quantity for ${mapping.groupName}: ${qty}`);
    
    if (qty > 0) {
      // Generate unique key similar to jobWorkflowInitializer
      const baseStageId = mapping.mappedStageId;
      const currentCount = stageIdCounts.get(baseStageId) || 0;
      stageIdCounts.set(baseStageId, currentCount + 1);
      
      const uniqueKey = currentCount === 0 ? baseStageId : `${baseStageId}-${currentCount + 1}`;
      
      quantityMap.set(uniqueKey, qty);
      this.logger.addDebugInfo(`✅ Set quantity ${qty} for unique key ${uniqueKey} (${mapping.mappedStageName})`);
    }
  });
}

    
    // Fallback to job qty if no specific quantities found
    const defaultQty = originalJob.qty || 1;
    
    this.logger.addDebugInfo(`📊 Found ${quantityMap.size} specific stage quantities, using default ${defaultQty} for others`);
    
    // Calculate timing for each stage instance
    const timingPromises = stageInstances.map(async (stageInstance) => {
      const quantity = this.getQuantityForStageInstance(stageInstance, quantityMap, defaultQty);

      
      this.logger.addDebugInfo(`⏱️ Calculating timing for stage instance ${stageInstance.id} with quantity ${quantity}`);
      
      try {
        // Update the stage instance with quantity first
        const { error: updateError } = await supabase
          .from('job_stage_instances')
          .update({
            quantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', stageInstance.id);
        
        if (updateError) {
          this.logger.addDebugInfo(`❌ Failed to update stage instance ${stageInstance.id}: ${updateError.message}`);
          return false;
        }
        
        // Calculate timing using the service
        const timingResult = await TimingCalculationService.calculateStageTimingWithInheritance({
          quantity,
          stageId: stageInstance.production_stage_id,
          specificationId: stageInstance.stage_specification_id || undefined
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
    
    this.logger.addDebugInfo(`🎯 Timing calculation completed for job ${woNo}: ${successCount}/${stageInstances.length} successful`);
    
  } catch (error) {
    this.logger.addDebugInfo(`❌ Error in timing calculation process for job ${woNo}: ${error}`);
  }
}

/**
 * Extract quantity from job specifications for a specific group
 */
private extractQuantityFromJobSpecs(job: ParsedJob, groupName: string): number {
  this.logger.addDebugInfo(`🔍 Extracting quantity for group: ${groupName}`);
  
  // Helper function to find spec by fuzzy matching
  const findSpecByFuzzyMatch = (specifications: any, category: string): { key: string; spec: any } | null => {
    if (!specifications) return null;
    
    // 1. Try exact match first
    if (specifications[groupName]) {
      this.logger.addDebugInfo(`✅ Found exact match for ${groupName} in ${category}`);
      return { key: groupName, spec: specifications[groupName] };
    }
    
    // 2. Extract base name from composite group names (e.g., "HP 12000 - Cover" -> "HP 12000")
    const baseName = groupName.replace(/\s*-\s*[^_]+$/i, '').trim();
    console.log(`[Excel Import] [QUANTITY FIX] Group: "${groupName}" -> Base: "${baseName}"`);
    
    // 3. Look for keys that start with the base name
    for (const [key, spec] of Object.entries(specifications)) {
      if (key.startsWith(baseName)) {
        // 4. Handle cover/text scenarios by checking suffixes
        if (groupName.toLowerCase().includes('cover') && key.toLowerCase().includes('cover')) {
          this.logger.addDebugInfo(`✅ Found cover match: ${key} for group ${groupName} in ${category}`);
          return { key, spec };
        }
        if (groupName.toLowerCase().includes('text') && key.toLowerCase().includes('text')) {
          this.logger.addDebugInfo(`✅ Found text match: ${key} for group ${groupName} in ${category}`);
          return { key, spec };
        }
        // 5. If no cover/text in group name, return first match
        if (!groupName.toLowerCase().includes('cover') && !groupName.toLowerCase().includes('text')) {
          this.logger.addDebugInfo(`✅ Found base name match: ${key} for group ${groupName} in ${category}`);
          return { key, spec };
        }
      }
    }
    
    return null;
  };
  
  // Try to find quantity in printing specifications first (most common)
  const printingMatch = findSpecByFuzzyMatch(job.printing_specifications, 'printing');
  if (printingMatch && printingMatch.spec.qty && printingMatch.spec.qty > 0) {
    this.logger.addDebugInfo(`📄 Found printing spec for ${groupName} via key ${printingMatch.key}: qty=${printingMatch.spec.qty}`);
    return printingMatch.spec.qty;
  }
  
  // Try to find quantity in finishing specifications  
  const finishingMatch = findSpecByFuzzyMatch(job.finishing_specifications, 'finishing');
  if (finishingMatch && finishingMatch.spec.qty && finishingMatch.spec.qty > 0) {
    this.logger.addDebugInfo(`🎨 Found finishing spec for ${groupName} via key ${finishingMatch.key}: qty=${finishingMatch.spec.qty}`);
    return finishingMatch.spec.qty;
  }
  
  // Try to find quantity in prepress specifications
  const prepressMatch = findSpecByFuzzyMatch(job.prepress_specifications, 'prepress');
  if (prepressMatch && prepressMatch.spec.qty && prepressMatch.spec.qty > 0) {
    this.logger.addDebugInfo(`⚙️ Found prepress spec for ${groupName} via key ${prepressMatch.key}: qty=${prepressMatch.spec.qty}`);
    return prepressMatch.spec.qty;
  }
  
  // Try to find quantity in paper specifications
  const paperMatch = findSpecByFuzzyMatch(job.paper_specifications, 'paper');
  if (paperMatch && paperMatch.spec.qty && paperMatch.spec.qty > 0) {
    this.logger.addDebugInfo(`📋 Found paper spec for ${groupName} via key ${paperMatch.key}: qty=${paperMatch.spec.qty}`);
    return paperMatch.spec.qty;
  }

  // Log what specifications are available for debugging
  this.logger.addDebugInfo(`🔍 Available printing specs: ${job.printing_specifications ? Object.keys(job.printing_specifications).join(', ') : 'none'}`);
  this.logger.addDebugInfo(`⚠️ No quantity found for group ${groupName}, using job default: ${job.qty || 1}`);
  
  // Return job qty as fallback
  return job.qty || 1;
}

/**
 * Add working days to a date (excluding weekends)
 */
private async addWorkingDays(startDate: Date, daysToAdd: number): Promise<Date> {
  let currentDate = new Date(startDate);
  let daysAdded = 0;

  while (daysAdded < daysToAdd) {
    currentDate.setDate(currentDate.getDate() + 1);
    // Simple weekend check (can be enhanced with holiday support later)
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
      daysAdded++;
    }
  }

  return currentDate;
}
/**
 * Get quantity for a stage instance with fallback logic
 */
private getQuantityForStageInstance(stageInstance: any, quantityMap: Map<string, number>, defaultQty: number): number {
  const uniqueKey = stageInstance.unique_stage_key;
  
  // Try exact unique key first
  if (uniqueKey && quantityMap.has(uniqueKey)) {
    return quantityMap.get(uniqueKey)!;
  }
  
  // Try base stage ID (remove suffix like -2, -3)
  const baseStageId = this.extractBaseStageId(uniqueKey || stageInstance.production_stage_id);
  if (quantityMap.has(baseStageId)) {
    return quantityMap.get(baseStageId)!;
  }
  
  // Fallback to default
  return defaultQty;
}

/**
 * Extract base stage ID by removing suffixes like -2, -3
 */
private extractBaseStageId(stageId: string): string {
  if (!stageId) return stageId;
  return stageId.replace(/-\d+$/, '');
}

/**
 * Store resolved mapping data back into job specifications
 * This ensures that extractUserApprovedMappings can find the stage specification IDs
 */
private storeMappingDataInJobSpecifications(job: ParsedJob, mappedStages: any[]): void {
  this.logger.addDebugInfo(`📝 Storing mapping data for ${mappedStages.length} stages back into job specifications`);
  
  mappedStages.forEach(stage => {
    const category = stage.category || 'printing';
    const groupName = stage.groupName || stage.originalSpec || 'Unknown';
    
    // Get the appropriate specifications object
    let specificationsObj = null;
    switch (category) {
      case 'printing':
        if (!job.printing_specifications) job.printing_specifications = {};
        specificationsObj = job.printing_specifications;
        break;
      case 'finishing':
        if (!job.finishing_specifications) job.finishing_specifications = {};
        specificationsObj = job.finishing_specifications;
        break;
      case 'prepress':
        if (!job.prepress_specifications) job.prepress_specifications = {};
        specificationsObj = job.prepress_specifications;
        break;
      case 'packaging':
        if (!job.packaging_specifications) job.packaging_specifications = {};
        specificationsObj = job.packaging_specifications;
        break;
      default:
        this.logger.addDebugInfo(`⚠️ Unknown category ${category}, defaulting to printing specifications`);
        if (!job.printing_specifications) job.printing_specifications = {};
        specificationsObj = job.printing_specifications;
    }
    
    // Store the mapping data in the existing spec or create new one
    if (specificationsObj[groupName]) {
      // Update existing specification with mapping data
      specificationsObj[groupName].mappedStageId = stage.stageId;
      specificationsObj[groupName].mappedStageName = stage.stageName;
      specificationsObj[groupName].mappedStageSpecId = stage.stageSpecId;
      specificationsObj[groupName].mappedStageSpecName = stage.stageSpecName;
      
      this.logger.addDebugInfo(`✅ Updated existing spec "${groupName}" with mapping data: ${stage.stageName}${stage.stageSpecName ? ` (${stage.stageSpecName})` : ''}`);
    } else {
      // Create new specification entry with mapping data
      specificationsObj[groupName] = {
        description: stage.originalSpec || groupName,
        qty: stage.qty || 1,
        mappedStageId: stage.stageId,
        mappedStageName: stage.stageName,
        mappedStageSpecId: stage.stageSpecId,
        mappedStageSpecName: stage.stageSpecName
      };
      
      this.logger.addDebugInfo(`🆕 Created new spec "${groupName}" with mapping data: ${stage.stageName}${stage.stageSpecName ? ` (${stage.stageSpecName})` : ''}`);
    }
  });
}

/**
 * Set simple due date for immediate feedback during job creation
 */
private async setSimpleDueDate(jobId: string, woNo: string): Promise<void> {
  try {
    this.logger.addDebugInfo(`📅 Setting simple due date for job ${woNo} (${jobId})`);
    
    // Simple due date calculator removed - using fallback
    this.logger.addDebugInfo(`⚠️ Simple due date calculator removed, using fallback for job ${woNo}`);
    await this.setFallbackDueDate(jobId);
    
  } catch (error) {
    this.logger.addDebugInfo(`❌ Error setting simple due date for job ${woNo}: ${error}`);
    await this.setFallbackDueDate(jobId);
  }
}

/**
 * Fallback due date setting (3 working days + 1 day buffer)
 */
private async setFallbackDueDate(jobId: string): Promise<void> {
  try {
    const { addWorkingDays } = await import('@/utils/tracker/workingDayCalculations');
    const today = new Date();
    const dueDate = addWorkingDays(today, 4); // 3 working days + 1 buffer
    
    await supabase
      .from('production_jobs')
      .update({
        due_date: dueDate.toISOString().split('T')[0],
        due_date_buffer_days: 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
      
  } catch (error) {
    this.logger.addDebugInfo(`❌ Even fallback due date failed: ${error}`);
  }
}

/**
 * Resolve mapping from database for fallback when job data lacks mapping information
 */
private resolveMappingFromDatabase(description: string, category: string): {stageId: string, stageName: string, stageSpecId?: string, stageSpecName?: string} | null {
  // Use the enhancedStageMapper's public method directly
  const match = this.enhancedStageMapper.findIntelligentStageMatch(description, description, category as any);
  
  if (match) {
    this.logger.addDebugInfo(`🔍 Resolved mapping from database: "${description}" -> ${match.stageName}${match.stageSpecName ? ` (${match.stageSpecName})` : ''}`);
    return {
      stageId: match.stageId,
      stageName: match.stageName,
      stageSpecId: match.stageSpecId,
      stageSpecName: match.stageSpecName
    };
  }
  
  this.logger.addDebugInfo(`❌ No database mapping found for: "${description}"`);
  return null;
}
}