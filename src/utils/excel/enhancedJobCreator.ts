import type { ParsedJob, RowMappingResult, GroupSpecifications } from './types';
import type { ExcelImportDebugger } from './debugger';
import { ProductionStageMapper, type CategoryAssignmentResult } from './productionStageMapper';
import { EnhancedStageMapper } from './enhancedStageMapper';
import { supabase } from '@/integrations/supabase/client';
import { generateQRCodeData, generateQRCodeImage } from '@/utils/qrCodeGenerator';
import { CoverTextWorkflowService } from '@/services/coverTextWorkflowService';
import { TimingCalculationService } from '@/services/timingCalculationService';

export interface EnhancedJobCreationResult {
  success: boolean;
  createdJobs: any[];
  failedJobs: { job: ParsedJob; error: string }[];
  categoryAssignments: { [woNo: string]: CategoryAssignmentResult };
  rowMappings: { [woNo: string]: RowMappingResult[] };
  userApprovedStageMappings?: Record<string, number>;
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
    userApprovedStageMappings?: Record<string, number>
  ): Promise<EnhancedJobCreationResult> {
    this.logger.addDebugInfo(`Preparing enhanced jobs for ${jobs.length} parsed jobs with Excel data`);
    this.logger.addDebugInfo(`Excel headers: ${JSON.stringify(headers)}`);
    this.logger.addDebugInfo(`Excel data rows: ${dataRows.length}`);
    
    // CRITICAL FIX: Log user-approved stage mappings being preserved
    if (userApprovedStageMappings && Object.keys(userApprovedStageMappings).length > 0) {
      this.logger.addDebugInfo(`🎯 PREPARE JOBS - PRESERVING USER-APPROVED STAGE MAPPINGS: ${Object.keys(userApprovedStageMappings).length} mappings`);
      Object.entries(userApprovedStageMappings).forEach(([stageId, columnIndex]) => {
        this.logger.addDebugInfo(`   - Stage ${stageId} -> Column ${columnIndex}`);
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
   * Finalize prepared jobs by saving them to the database
   */
  async finalizeJobs(preparedResult: EnhancedJobCreationResult, userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>): Promise<EnhancedJobCreationResult> {
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
        // Use the original job stored in the assignment
        if (assignment.originalJob) {
          // Create the job in database using the prepared data
          await this.finalizeIndividualJob(woNo, assignment, preparedResult, finalResult, userApprovedMappings);
          finalResult.stats.successful++;
          finalResult.stats.workflowsInitialized++;
        } else {
          this.logger.addDebugInfo(`No original job data found for ${woNo}, skipping`);
          finalResult.stats.failed++;
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
    dataRows: any[][],
    userApprovedStageMappings?: Record<string, number>
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

    // 1. Map specifications to production stages using enhanced mapper with user-approved mappings
    const userApprovedMappings = this.extractUserApprovedMappings(job);
    
    // CRITICAL FIX: Convert job.paper_specifications to GroupSpecifications format for stage mapper
    const paperSpecsForMapping = this.convertPaperSpecsToGroupFormat(job.paper_specifications);
    this.logger.addDebugInfo(`🎯 CONVERTED PAPER SPECS: ${JSON.stringify(paperSpecsForMapping)}`);
    
    const mappedStages = this.enhancedStageMapper.mapGroupsToStagesIntelligent(
      job.printing_specifications,
      job.finishing_specifications,
      job.prepress_specifications,
      userApprovedMappings,
      paperSpecsForMapping  // Pass converted paper specifications
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
        headers || [],
        job.paper_specifications
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

    // 6. Auto-create custom workflow from mapped stages
    await this.initializeCustomWorkflow(insertedJob, originalJob, finalResult, userApprovedMappings);
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
      paperSpecsForMapping  // Pass converted paper specifications
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
        headers || [],
        job.paper_specifications
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
  }

  /**
   * Build enhanced job data with all necessary fields
   */
  private async buildEnhancedJobData(job: ParsedJob, categoryId: string | null): Promise<any> {
    this.logger.addDebugInfo(`Building enhanced job data for ${job.wo_no}`);

    // Generate QR code if enabled
    let qrCodeData = null;
    let qrCodeUrl = null;
    
    if (this.generateQRCodes) {
      qrCodeData = JSON.stringify({ wo_no: job.wo_no, table: 'production_jobs' });
      try {
        qrCodeUrl = await generateQRCodeImage(qrCodeData);
        this.logger.addDebugInfo(`Generated QR code for job ${job.wo_no}`);
      } catch (qrError) {
        this.logger.addDebugInfo(`Warning: QR code generation failed for ${job.wo_no}: ${qrError}`);
        // Continue without QR code
      }
    }

    const enhancedJobData = {
      user_id: this.userId,
      wo_no: job.wo_no,
      status: job.status || 'Pending',
      date: job.date || null,
      rep: job.rep || null,
      category: job.category || null,
      category_id: categoryId,
      customer: job.customer || null,
      reference: job.reference || null,
      qty: job.qty || null,
      due_date: job.due_date || null,
      location: job.location || null,
      size: job.size || null,
      specification: job.specification || null,
      contact: job.contact || null,
      // Store JSON specifications
      paper_specifications: job.paper_specifications || {},
      delivery_specifications: job.delivery_specifications || {},
      finishing_specifications: job.finishing_specifications || {},
      prepress_specifications: job.prepress_specifications || {},
      printing_specifications: job.printing_specifications || {},
      operation_quantities: job.operation_quantities || {},
      // QR code data
      qr_code_data: qrCodeData,
      qr_code_url: qrCodeUrl,
      // Mark as custom workflow since we're not using categories
      has_custom_workflow: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.logger.addDebugInfo(`Enhanced job data built for ${job.wo_no} with ${Object.keys(enhancedJobData).length} fields`);
    return enhancedJobData;
  }

  private async updateJobQRCode(job: any): Promise<void> {
    if (!job.qr_code_data) return;

    // Update QR code data with actual job ID
    const updatedQRData = JSON.parse(job.qr_code_data);
    updatedQRData.jobId = job.id;
    
    const { error } = await supabase
      .from('production_jobs')
      .update({
        qr_code_data: JSON.stringify(updatedQRData),
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id);

    if (error) {
      throw new Error(`Failed to update QR code: ${error.message}`);
    }

    this.logger.addDebugInfo(`Updated QR code with job ID for ${job.wo_no}`);
  }

  private async calculateAndSetDueDate(jobId: string, job: ParsedJob): Promise<void> {
    try {
      this.logger.addDebugInfo(`Calculating due date for job ${job.wo_no}`);

      // If manual due date is already set, use it
      if (job.due_date) {
        this.logger.addDebugInfo(`Manual due date already set for ${job.wo_no}: ${job.due_date}`);
        return;
      }

      // Calculate due date based on stage durations
      const { data: stageInstances, error: stageError } = await supabase
        .from('job_stage_instances')
        .select('estimated_duration_minutes')
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs');

      if (stageError || !stageInstances) {
        this.logger.addDebugInfo(`No stage instances found for due date calculation: ${stageError?.message}`);
        return;
      }

      // Sum up all estimated durations (converted to days)
      const totalMinutes = stageInstances.reduce((sum, stage) => {
        return sum + (stage.estimated_duration_minutes || 0);
      }, 0);

      const totalDays = Math.ceil(totalMinutes / (8 * 60)); // Assuming 8-hour workdays
      const calculatedDueDate = new Date();
      calculatedDueDate.setDate(calculatedDueDate.getDate() + totalDays);

      // Update job with calculated due date
      const { error: updateError } = await supabase
        .from('production_jobs')
        .update({
          due_date: calculatedDueDate.toISOString().split('T')[0],
          manual_sla_days: totalDays,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (updateError) {
        this.logger.addDebugInfo(`Failed to update due date: ${updateError.message}`);
      } else {
        this.logger.addDebugInfo(`Set calculated due date for ${job.wo_no}: ${calculatedDueDate.toISOString().split('T')[0]} (${totalDays} days)`);
      }

    } catch (error) {
      this.logger.addDebugInfo(`Error calculating due date: ${error}`);
    }
  }

  /**
   * Initialize custom workflow using Supabase RPC
   */
  private async initializeDefaultCustomWorkflow(insertedJob: any, originalJob: ParsedJob): Promise<void> {
    this.logger.addDebugInfo(`Initializing default custom workflow for job ${originalJob.wo_no} (ID: ${insertedJob.id})`);
    
    // Get category assignment from enhanced data
    const categoryAssignment = insertedJob.category_id;
    
    if (!categoryAssignment) {
      this.logger.addDebugInfo(`No category assigned for job ${originalJob.wo_no}, creating basic workflow`);
      return;
    }

    // Use Supabase RPC to initialize workflow
    const { error } = await supabase.rpc('initialize_job_stages_auto', {
      p_job_id: insertedJob.id,
      p_job_table_name: 'production_jobs',
      p_category_id: categoryAssignment
    });

    if (error) {
      throw new Error(`Failed to initialize workflow: ${error.message}`);
    }

    // Update stage instances with appropriate quantities based on operation_quantities
    await this.updateStageQuantities(insertedJob.id);
  }

  /**
   * Fallback timing calculation method for backward compatibility
   */
  private calculateStageTiming(
    quantity: number,
    runningSpeedPerHour: number = 100,
    makeReadyTimeMinutes: number = 10,
    speedUnit: string = 'sheets_per_hour'
  ): number {
    if (quantity <= 0 || runningSpeedPerHour <= 0) {
      return makeReadyTimeMinutes;
    }

    let productionMinutes = 0;

    switch (speedUnit) {
      case 'sheets_per_hour':
      case 'items_per_hour':
        productionMinutes = Math.ceil((quantity / runningSpeedPerHour) * 60);
        break;
      case 'minutes_per_item':
        productionMinutes = quantity * runningSpeedPerHour;
        break;
      default:
        productionMinutes = Math.ceil((quantity / runningSpeedPerHour) * 60);
    }

    return productionMinutes + makeReadyTimeMinutes;
  }

  private async initializeCustomWorkflow(insertedJob: any, originalJob: ParsedJob, result: EnhancedJobCreationResult, userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>): Promise<void> {
    try {
      this.logger.addDebugInfo(`Initializing custom workflow for job ${originalJob.wo_no} (ID: ${insertedJob.id})`);
      
    // CRITICAL FIX: Use user-approved stage mappings from dialog
    if (userApprovedMappings && userApprovedMappings.length > 0) {
      this.logger.addDebugInfo(`🔍 INITIALIZE CUSTOM WORKFLOW - USER-APPROVED STAGE MAPPINGS: ${userApprovedMappings.length} mappings found:`);
      userApprovedMappings.forEach((mapping) => {
        this.logger.addDebugInfo(`   - Group "${mapping.groupName}" -> Stage ${mapping.mappedStageId} (${mapping.mappedStageName}) [${mapping.category}]`);
      });
      
      this.logger.addDebugInfo(`🎯 SURGICAL FIX: CREATING WORKFLOW FROM USER-APPROVED MAPPINGS (${userApprovedMappings.length} stages)`);
      this.logger.addDebugInfo(`🚀 BYPASSING ALL AUTO-DETECTION - USING ONLY USER CHOICES`);
      await this.createStageInstancesFromUserMappings(insertedJob, originalJob, userApprovedMappings);
      
      // Mark job as having custom workflow
      await supabase
        .from('production_jobs')
        .update({ has_custom_workflow: true })
        .eq('id', insertedJob.id);
        
      this.logger.addDebugInfo(`✅ SURGICAL FIX COMPLETE: Created ${userApprovedMappings.length} stages from user mappings`);
      return;
    }
      
      // Fallback: Use the row mappings if no user-approved mappings
      const rowMappings = result.rowMappings[originalJob.wo_no] || [];
      this.logger.addDebugInfo(`Using ${rowMappings.length} existing row mappings for workflow initialization`);
      
      if (rowMappings.length === 0) {
        this.logger.addDebugInfo(`❌ NO MAPPINGS found for job ${originalJob.wo_no} - skipping workflow initialization`);
        return;
      }

      // Get all production stages ordered by system-defined order_index 
      const { data: allProductionStages, error: stagesError } = await supabase
        .from('production_stages')
        .select('id, name, order_index, supports_parts')
        .eq('is_active', true)
        .order('order_index');

      if (stagesError || !allProductionStages) {
        throw new Error(`Failed to load production stages: ${stagesError?.message}`);
      }

      // Separate printing and paper mappings for quantity-based pairing
      const printingMappings = rowMappings.filter(mapping => 
        !mapping.isUnmapped && mapping.mappedStageId && mapping.category === 'printing'
      );
      const paperMappings = rowMappings.filter(mapping => 
        !mapping.isUnmapped && mapping.category === 'paper'
      );
      
      this.logger.addDebugInfo(`Found ${printingMappings.length} printing mappings and ${paperMappings.length} paper mappings`);

      // Sort both printing and paper mappings by quantity (ascending)
      const sortedPrintingMappings = printingMappings.sort((a, b) => (a.qty || 0) - (b.qty || 0));
      const sortedPaperMappings = paperMappings.sort((a, b) => (a.qty || 0) - (b.qty || 0));
      
      this.logger.addDebugInfo(`Sorted printing quantities: ${sortedPrintingMappings.map(m => m.qty).join(', ')}`);
      this.logger.addDebugInfo(`Sorted paper quantities: ${sortedPaperMappings.map(m => m.qty).join(', ')}`);

      // Create paper-to-printing allocation map
      const paperToStageMap = new Map<string, string>();
      if (sortedPrintingMappings.length > 0 && sortedPaperMappings.length > 0) {
        // Pair smallest with smallest, largest with largest
        for (let i = 0; i < Math.min(sortedPrintingMappings.length, sortedPaperMappings.length); i++) {
          const printingMapping = sortedPrintingMappings[i];
          const paperMapping = sortedPaperMappings[i];
          
          // Look up paper specification from excel import mappings
          const paperSpec = await this.lookupPaperSpecification(paperMapping.description);
          
          paperToStageMap.set(printingMapping.mappedStageId!, paperSpec || paperMapping.description);
          
          this.logger.addDebugInfo(`Paired printing (qty: ${printingMapping.qty}) with paper "${paperMapping.description}" -> spec: "${paperSpec}"`);
        }
      }

      // CRITICAL FIX: Group mappings by instanceId instead of stageId to support multi-row printing
      const instanceGroups = new Map<string, {mapping: any, paperType?: string}>();
      
      rowMappings
        .filter(mapping => !mapping.isUnmapped && mapping.mappedStageId)
        .forEach((mapping) => {
          // Use instanceId for grouping to preserve Cover/Text separation
          const instanceKey = mapping.instanceId || `${mapping.mappedStageId}_${mapping.excelRowIndex}`;
          
          // Get paper type from allocation map for printing stages
          let paperType = '';
          if (mapping.category === 'printing') {
            paperType = paperToStageMap.get(mapping.mappedStageId!) || '';
          }
          
          instanceGroups.set(instanceKey, { 
            mapping, 
            paperType: paperType || mapping.paperSpecification || ''
          });
        });

      this.logger.addDebugInfo(`Grouped mappings into ${instanceGroups.size} unique instances (enabling multi-row printing)`);

      // Create stage instances with proper system ordering and multi-instance support
      const stageInstances: Array<{
        stageId: string;
        stageName: string;
        systemOrder: number;
        partName: string;
        quantity: number;
        mapping: any;
        paperType?: string;
        stageSpecId?: string;
        stageSpecName?: string;
      }> = [];

      // Process each instance group to create separate instances
      for (const [instanceKey, {mapping, paperType}] of instanceGroups.entries()) {
        const productionStage = allProductionStages.find(ps => ps.id === mapping.mappedStageId);
        if (!productionStage) {
          this.logger.addDebugInfo(`Warning: Production stage ${mapping.mappedStageId} not found in system stages`);
          continue;
        }

        this.logger.addDebugInfo(`Processing instance: ${productionStage.name} (${mapping.partType || 'standard'})`);

        // Create meaningful part names that include paper specifications and part types
        let partName = productionStage.name;
        if (mapping.partType) {
          partName = `${productionStage.name} - ${mapping.partType}`;
          if (mapping.paperSpecification || paperType) {
            partName = `${productionStage.name} - ${mapping.partType} (${mapping.paperSpecification || paperType})`;
          }
        } else if (mapping.paperSpecification || paperType) {
          partName = `${productionStage.name} - ${mapping.paperSpecification || paperType}`;
        }

        // Get quantity from mapping (already set correctly for Cover/Text in enhancedStageMapper)
        const quantity = mapping.qty || mapping.woQty || originalJob.qty || 1;

        stageInstances.push({
          stageId: productionStage.id,
          stageName: productionStage.name,
          systemOrder: productionStage.order_index,
          partName,
          quantity,
          mapping,
          paperType: mapping.paperSpecification || paperType,
          stageSpecId: mapping.mappedStageSpecId,
          stageSpecName: mapping.mappedStageSpecName
        });

        this.logger.addDebugInfo(`Created stage instance: ${partName} with quantity ${quantity}, stageSpec: ${mapping.mappedStageSpecName || 'none'}`);
      }

      // Sort stage instances by system-defined order to ensure proper workflow sequence
      stageInstances.sort((a, b) => a.systemOrder - b.systemOrder);

      if (stageInstances.length === 0) {
        this.logger.addDebugInfo(`No valid stage mappings for job ${originalJob.wo_no}, skipping workflow initialization`);
        return;
      }

      this.logger.addDebugInfo(`Creating ${stageInstances.length} stage instances in system order for job ${originalJob.wo_no}`);
      
      // Create stage instances in database with correct ordering and timing calculations
      const stageInsertPromises = stageInstances.map(async (instance, index) => {
        // CRITICAL FIX: Calculate timing using stage specification or fallback to production stage
        const timingResult = await this.calculateStageTimingWithInheritance(
          instance.quantity, 
          instance.stageId, 
          instance.stageSpecId
        );
        
        const { data, error } = await supabase
          .from('job_stage_instances')
          .insert({
            job_id: insertedJob.id,
            job_table_name: 'production_jobs',
            production_stage_id: instance.stageId,
            stage_order: index + 1, // Use sequential order based on system ordering
            status: 'pending',
            part_name: instance.partName || null,
            part_type: instance.mapping.partType?.toLowerCase() || null, // Store cover/text flag
            stage_specification_id: instance.stageSpecId || null, // CRITICAL: Store stage specification
            quantity: instance.quantity || 0, // Ensure quantity is always set
            estimated_duration_minutes: timingResult.estimatedDuration,
            setup_time_minutes: timingResult.setupTime
          })
          .select('id, production_stage_id, part_name, quantity, estimated_duration_minutes, stage_specification_id')
          .single();
          
        if (error) {
          this.logger.addDebugInfo(`Failed to create stage instance for ${instance.stageName}: ${error.message}`);
          throw new Error(`Failed to create stage instance for ${instance.stageName}: ${error.message}`);
        }

        // CRITICAL FIX: Create paper allocation for printing stages
        if (instance.mapping.category === 'printing' && instance.paperType) {
          await this.createJobPrintSpecification(
            insertedJob.id,
            'production_jobs',
            instance.paperType,
            data.id
          );
        }
        
        this.logger.addDebugInfo(`Created stage instance: ${instance.stageName} (Part: ${instance.partName || 'none'}) - Qty: ${instance.quantity} - Duration: ${timingResult.estimatedDuration}min - ID: ${data.id}`);
        return data;
      });

      // Execute all stage creations
      const createdStageInstances = await Promise.all(stageInsertPromises);
      
      this.logger.addDebugInfo(`Successfully created ${createdStageInstances.length} stage instances for job ${originalJob.wo_no}`);
      
      // Mark job as having custom workflow
      await supabase
        .from('production_jobs')
        .update({ has_custom_workflow: true })
        .eq('id', insertedJob.id);

      // Calculate and set due date based on stage durations (now with proper quantities)
      await this.calculateAndSetDueDate(insertedJob.id, originalJob);

      this.logger.addDebugInfo(`Custom workflow initialized for ${originalJob.wo_no} with ${stageInstances.length} stage instances`);
      
      // Verify stages were actually created by querying the database
      const { data: createdStages, error: verifyError } = await supabase
        .from('job_stage_instances')
        .select('id, production_stage_id, status')
        .eq('job_id', insertedJob.id)
        .eq('job_table_name', 'production_jobs');

      if (verifyError) {
        this.logger.addDebugInfo(`ERROR: Failed to verify created stages: ${verifyError.message}`);
        throw new Error(`Could not verify workflow stages were created for job ${originalJob.wo_no}`);
      } else if (!createdStages || createdStages.length === 0) {
        this.logger.addDebugInfo(`CRITICAL: No stages found in database after initialization!`);
        throw new Error(`Workflow stages were not created for job ${originalJob.wo_no}. Database verification failed.`);
      } else {
        this.logger.addDebugInfo(`SUCCESS: ${createdStages.length} stages verified in database`);
        
        // Log each created stage for debugging
        createdStages.forEach(stage => {
          this.logger.addDebugInfo(`  - Stage ${stage.production_stage_id}: ${stage.status}`);
        });
      }
      
    } catch (error) {
      this.logger.addDebugInfo(`Custom workflow initialization error for ${originalJob.wo_no}: ${error}`);
      throw error; // Re-throw to ensure errors are visible in the UI
    }
  }


  /**
   * REVERTED: Calculate stage timing with fault-tolerant fallbacks
   * Tries live database timing first, then uses local fallback
   */
  private async calculateStageTimingWithInheritance(
    quantity: number, 
    stageId: string, 
    stageSpecId?: string
  ): Promise<{estimatedDuration: number, setupTime: number}> {
    try {
      // Try enhanced timing service for live database timing reference
      const timingResult = await TimingCalculationService.calculateStageTimingWithInheritance({
        quantity,
        stageId,
        specificationId: stageSpecId
      });

      this.logger.addDebugInfo(`✅ Live timing calculation: ${timingResult.estimatedDurationMinutes}min (${timingResult.speedUsed} ${timingResult.speedUnit}) - Source: ${timingResult.calculationSource}`);

      return {
        estimatedDuration: timingResult.estimatedDurationMinutes,
        setupTime: timingResult.makeReadyMinutes
      };
      
    } catch (error) {
      this.logger.addDebugInfo(`⚠️ Enhanced timing failed, using local fallback: ${error}`);
      
      // FAULT-TOLERANT: Use local calculation as fallback
      const fallbackDuration = this.calculateStageTiming(quantity, 100, 10, 'sheets_per_hour');
      this.logger.addDebugInfo(`🔄 Fallback timing calculation: ${fallbackDuration}min`);
      
      return {
        estimatedDuration: fallbackDuration,
        setupTime: 10 // Default setup time
      };
    }
  }

  /**
   * CRITICAL FIX: Create job print specification for paper allocation
   */
  private async createJobPrintSpecification(
    jobId: string,
    jobTableName: string,
    paperSpecification: string,
    stageInstanceId?: string
  ): Promise<void> {
    try {
      // Look up paper specification in print_specifications table
      const { data: paperSpecs, error: paperError } = await supabase
        .from('print_specifications')
        .select('id, category, name, display_name')
        .or(`name.ilike.%${paperSpecification}%,display_name.ilike.%${paperSpecification}%`)
        .in('category', ['paper_type', 'paper_weight'])
        .eq('is_active', true);

      if (paperError || !paperSpecs?.length) {
        this.logger.addDebugInfo(`Warning: Could not find paper specification for "${paperSpecification}"`);
        return;
      }

      // Create job print specification entries for each found paper spec
      for (const spec of paperSpecs) {
        const { error: insertError } = await supabase
          .from('job_print_specifications')
          .insert({
            job_id: jobId,
            job_table_name: jobTableName,
            specification_id: spec.id,
            specification_category: spec.category
          });

        if (insertError) {
          this.logger.addDebugInfo(`Warning: Failed to create job print specification: ${insertError.message}`);
        } else {
          this.logger.addDebugInfo(`✅ Created job print specification: ${spec.display_name} (${spec.category})`);
        }
      }
    } catch (error) {
      this.logger.addDebugInfo(`Error creating job print specification: ${error}`);
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

      const operationQuantities = job.operation_quantities as any;
      this.logger.addDebugInfo(`Found operation quantities: ${JSON.stringify(operationQuantities)}`);

      // Get all stage instances for this job
      const { data: stageInstances, error: stageError } = await supabase
        .from('job_stage_instances')
        .select('id, production_stage_id, quantity')
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs');

      if (stageError || !stageInstances) {
        this.logger.addDebugInfo(`No stage instances found: ${stageError?.message}`);
        return;
      }

      // Update each stage instance with appropriate quantity
      const updatePromises = stageInstances.map(async (stageInstance, index) => {
        let newQuantity = stageInstance.quantity || 0;

        // Try to match stage with operation quantities
        const operations = Object.entries(operationQuantities);
        if (operations.length > index) {
          const [operationKey, operationData] = operations[index];
          const opData = operationData as any;
          
          if (opData.operation_qty && opData.operation_qty > 0) {
            newQuantity = opData.operation_qty;
          } else if (opData.total_wo_qty && opData.total_wo_qty > 0) {
            newQuantity = opData.total_wo_qty;
          }
          
          this.logger.addDebugInfo(`Updating stage ${stageInstance.id} quantity to ${newQuantity} from operation ${operationKey}`);
        }

        // Update the stage instance
        const { error: updateError } = await supabase
          .from('job_stage_instances')
          .update({ quantity: newQuantity })
          .eq('id', stageInstance.id);

        if (updateError) {
          this.logger.addDebugInfo(`Failed to update stage ${stageInstance.id} quantity: ${updateError.message}`);
        }
      });

      await Promise.all(updatePromises);
      this.logger.addDebugInfo(`Completed stage quantity updates for job ${jobId}`);

    } catch (error) {
      this.logger.addDebugInfo(`Error updating stage quantities: ${error}`);
    }
  }

  private async assignBestCategory(job: ParsedJob): Promise<{ categoryId: string; categoryName: string; confidence: number } | null> {
    try {
      // Simplified category assignment - using mapped stages instead
      return null;
    } catch (error) {
      this.logger.addDebugInfo(`Error assigning category for job ${job.wo_no}: ${error}`);
      return null;
    }
  }

  private async getDefaultStageMapping(job: ParsedJob): Promise<{ stageId: string; stageName: string } | null> {
    try {
      // Get the first available active stage as default
      const { data: stages, error } = await supabase
        .from('production_stages')
        .select('id, name')
        .eq('is_active', true)
        .order('order_index')
        .limit(1);

      if (error || !stages || stages.length === 0) {
        this.logger.addDebugInfo(`No active stages available for default mapping: ${error?.message}`);
        return null;
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

  private getCategoryFromStage(stageName: string): 'printing' | 'finishing' | 'prepress' | 'delivery' | 'paper' | 'unknown' {
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
    if (name.includes('paper') || name.includes('gsm') || name.includes('stock')) {
      return 'paper';
    }
    return 'unknown';
  }

  /**
   * Look up paper specification from excel import mappings
   */
  private async lookupPaperSpecification(paperDescription: string): Promise<string | null> {
    try {
      // Query excel import mappings for paper specifications
      const { data: mappings, error } = await supabase
        .from('excel_import_mappings')
        .select(`
          paper_type_specification_id,
          paper_weight_specification_id
        `)
        .ilike('excel_text', `%${paperDescription}%`)
        .not('paper_type_specification_id', 'is', null)
        .limit(5);

      if (error || !mappings || mappings.length === 0) {
        this.logger.addDebugInfo(`No paper mapping found for: ${paperDescription}`);
        return null;
      }

      // Get the specification details
      const parts: string[] = [];
      const mapping = mappings[0];
      
      // Look up paper type specification
      if (mapping.paper_type_specification_id) {
        const { data: typeSpec } = await supabase
          .from('print_specifications')
          .select('display_name')
          .eq('id', mapping.paper_type_specification_id)
          .single();
        
        if (typeSpec) parts.push(typeSpec.display_name);
      }
      
      // Look up paper weight specification
      if (mapping.paper_weight_specification_id) {
        const { data: weightSpec } = await supabase
          .from('print_specifications')
          .select('display_name')
          .eq('id', mapping.paper_weight_specification_id)
          .single();
        
        if (weightSpec) parts.push(weightSpec.display_name);
      }
      
      if (parts.length > 0) {
        const paperSpec = parts.join(' + ');
        this.logger.addDebugInfo(`Mapped "${paperDescription}" -> "${paperSpec}"`);
        return paperSpec;
      }

      return null;
    } catch (error) {
      this.logger.addDebugInfo(`Error looking up paper specification: ${error}`);
      return null;
    }
  }

  /**
   * Extract paper type for a specific printing operation from job's paper specifications
   */
  private extractPaperTypeForPrinting(mapping: any, paperSpecs: any): string {
    try {
      // Look for paper specifications that match this printing operation
      if (paperSpecs.group_specifications) {
        for (const [paperGroup, paperSpec] of Object.entries(paperSpecs.group_specifications)) {
          const paperData = paperSpec as any;
          if (paperData.description) {
            // Match paper type by description or group name patterns
            const paperDesc = paperData.description.toLowerCase();
            const mappingDesc = mapping.description.toLowerCase();
            
            // Look for common patterns that link paper to printing operations
            if (paperDesc.includes('gsm') || paperDesc.includes('paper') || paperDesc.includes('stock')) {
              return paperData.description;
            }
          }
        }
      }
      
      return '';
    } catch (error) {
      this.logger.addDebugInfo(`Error extracting paper type: ${error}`);
      return '';
    }
  }

  /**
   * Extract user-approved stage mappings from job data
   * STRENGTHENED: Handle incomplete data and provide fallback stage name resolution
   */
  private extractUserApprovedMappings(job: ParsedJob): Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}> {
    const mappings: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}> = [];
    
    this.logger.addDebugInfo(`Extracting user-approved stage mappings from job ${job.wo_no}...`);
    
    // Check if job has user-approved mappings stored anywhere
    // Look for mappedStageId values in specifications
    
    if (job.printing_specifications) {
      for (const [groupName, spec] of Object.entries(job.printing_specifications)) {
        const specData = spec as any;
        if (specData.mappedStageId) {
          // STRENGTHENED: Handle case where mappedStageName might be missing
          let stageName = specData.mappedStageName;
          
          if (!stageName) {
            // Fallback: Try to resolve stage name from stage ID by querying database
            this.logger.addDebugInfo(`Missing stage name for ${groupName}, stage ID: ${specData.mappedStageId} - attempting fallback resolution`);
            // For now, we'll use a placeholder since we can't make async calls here
            // The applyUserStageMapping should have already set both values
            stageName = `Stage_${specData.mappedStageId}`;
          }
          
          mappings.push({
            groupName,
            mappedStageId: specData.mappedStageId,
            mappedStageName: stageName,
            category: 'printing'
          });
          
          this.logger.addDebugInfo(`Found user mapping in printing specs: ${groupName} -> ${stageName} (${specData.mappedStageId})`);
        }
      }
    }
    
    if (job.finishing_specifications) {
      for (const [groupName, spec] of Object.entries(job.finishing_specifications)) {
        const specData = spec as any;
        if (specData.mappedStageId) {
          let stageName = specData.mappedStageName;
          
          if (!stageName) {
            this.logger.addDebugInfo(`Missing stage name for ${groupName}, stage ID: ${specData.mappedStageId} - attempting fallback resolution`);
            stageName = `Stage_${specData.mappedStageId}`;
          }
          
          mappings.push({
            groupName,
            mappedStageId: specData.mappedStageId,
            mappedStageName: stageName,
            category: 'finishing'
          });
          
          this.logger.addDebugInfo(`Found user mapping in finishing specs: ${groupName} -> ${stageName} (${specData.mappedStageId})`);
        }
      }
    }
    
    if (job.prepress_specifications) {
      for (const [groupName, spec] of Object.entries(job.prepress_specifications)) {
        const specData = spec as any;
        if (specData.mappedStageId) {
          let stageName = specData.mappedStageName;
          
          if (!stageName) {
            this.logger.addDebugInfo(`Missing stage name for ${groupName}, stage ID: ${specData.mappedStageId} - attempting fallback resolution`);
            stageName = `Stage_${specData.mappedStageId}`;
          }
          
          mappings.push({
            groupName,
            mappedStageId: specData.mappedStageId,
            mappedStageName: stageName,
            category: 'prepress'
          });
          
          this.logger.addDebugInfo(`Found user mapping in prepress specs: ${groupName} -> ${stageName} (${specData.mappedStageId})`);
        }
      }
    }
    
    this.logger.addDebugInfo(`TOTAL EXTRACTED USER MAPPINGS: ${mappings.length} from job ${job.wo_no}`);
    mappings.forEach(mapping => {
      this.logger.addDebugInfo(`  - ${mapping.groupName} -> ${mapping.mappedStageName} (${mapping.mappedStageId}) [${mapping.category}]`);
    });
    
    if (mappings.length === 0) {
      this.logger.addDebugInfo(`⚠️  NO USER MAPPINGS FOUND - This will cause fallback to text-pattern detection!`);
    }
    
    return mappings;
  }

  /**
   * SURGICAL FIX: Create stage instances directly from user-approved mappings
   * This bypasses any issues with row mapping generation and uses the raw user mappings
   */
  private async createStageInstancesFromUserMappings(
    insertedJob: any, 
    originalJob: ParsedJob, 
    userApprovedMappings: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
  ): Promise<void> {
    this.logger.addDebugInfo(`🔧 SURGICAL FIX: Creating ${userApprovedMappings.length} stage instances directly from user mappings`);
    
    // Get all production stages for system ordering
    const { data: allProductionStages, error: stagesError } = await supabase
      .from('production_stages')
      .select('id, name, order_index, supports_parts')
      .eq('is_active', true)
      .order('order_index');

    if (stagesError || !allProductionStages) {
      throw new Error(`Failed to load production stages: ${stagesError?.message}`);
    }

    // Create a map for quick stage lookup
    const stageMap = new Map(allProductionStages.map(stage => [stage.id, stage]));
    
    // Sort user mappings by stage system order to maintain proper workflow sequence
    const sortedMappings = userApprovedMappings
      .map(mapping => ({
        ...mapping,
        systemOrder: stageMap.get(mapping.mappedStageId)?.order_index || 999
      }))
      .sort((a, b) => a.systemOrder - b.systemOrder);
    
    this.logger.addDebugInfo(`Sorted user mappings by system order: ${sortedMappings.map(m => m.mappedStageName).join(' -> ')}`);
    
    // Create stage instances directly
    const stageInsertPromises = sortedMappings.map(async (mapping, index) => {
      const stage = stageMap.get(mapping.mappedStageId);
      if (!stage) {
        this.logger.addDebugInfo(`Warning: Stage ${mapping.mappedStageId} not found in system stages`);
        return;
      }
      
      // Use job quantity or default to 1
      const quantity = originalJob.qty || 1;
      
      // Calculate timing using live stage/specification reference (no hardcoded fallbacks)
      const timingResult = await this.calculateStageTimingWithInheritance(quantity, mapping.mappedStageId);
      
      const { data, error } = await supabase
        .from('job_stage_instances')
        .insert({
          job_id: insertedJob.id,
          job_table_name: 'production_jobs',
          production_stage_id: mapping.mappedStageId,
          stage_order: index + 1, // Sequential order based on system ordering
          status: 'pending',
          part_name: `${mapping.mappedStageName} - ${mapping.groupName}`,
          part_type: mapping.category?.toLowerCase() || null,
          stage_specification_id: null, // User-approved mappings don't have stage specifications
          quantity: quantity,
          estimated_duration_minutes: timingResult.estimatedDuration,
          setup_time_minutes: timingResult.setupTime
        })
        .select('id, production_stage_id, part_name, quantity, estimated_duration_minutes')
        .single();

      if (error) {
        this.logger.addDebugInfo(`Failed to create stage instance for ${mapping.mappedStageName}: ${error.message}`);
        throw error;
      }

      this.logger.addDebugInfo(`✅ Created stage instance: ${mapping.mappedStageName} (${mapping.groupName}) with quantity ${quantity}`);
      return data;
    });

    // Execute all stage creation promises
    const stageInstances = await Promise.all(stageInsertPromises);
    const successfulInstances = stageInstances.filter(instance => instance !== undefined);
    
    this.logger.addDebugInfo(`🎉 SURGICAL FIX SUCCESS: Created ${successfulInstances.length}/${userApprovedMappings.length} stage instances from user mappings`);
  }

  /**
   * CRITICAL FIX: Create stage instances directly from user-approved stage mappings
   * This method works with the Record<string, number> format from the Enhanced Production Job Creation modal
   */
  private async createStageInstancesFromUserApprovedMappings(
    insertedJob: any, 
    originalJob: ParsedJob, 
    userApprovedStageMappings: Record<string, number>,
    result: EnhancedJobCreationResult
  ): Promise<void> {
    this.logger.addDebugInfo(`🎯 CREATING WORKFLOW FROM USER-APPROVED MAPPINGS: ${Object.keys(userApprovedStageMappings).length} stages`);
    
    // Get all production stages for system ordering and stage details
    const { data: allProductionStages, error: stagesError } = await supabase
      .from('production_stages')
      .select('id, name, order_index, supports_parts')
      .eq('is_active', true)
      .order('order_index');

    if (stagesError || !allProductionStages) {
      throw new Error(`Failed to load production stages: ${stagesError?.message}`);
    }

    // Create a map for quick stage lookup
    const stageMap = new Map(allProductionStages.map(stage => [stage.id, stage]));
    
    // Convert user mappings to array and sort by stage system order
    const stageEntries = Object.entries(userApprovedStageMappings)
      .map(([stageId, columnIndex]) => {
        const stage = stageMap.get(stageId);
        return {
          stageId,
          columnIndex,
          stage,
          systemOrder: stage?.order_index || 999
        };
      })
      .filter(entry => entry.stage) // Only include valid stages
      .sort((a, b) => a.systemOrder - b.systemOrder);
    
    this.logger.addDebugInfo(`Sorted ${stageEntries.length} user-approved stages by system order: ${stageEntries.map(e => e.stage!.name).join(' -> ')}`);
    
    // Create stage instances directly
    const stageInsertPromises = stageEntries.map(async (entry, index) => {
      const { stageId, stage } = entry;
      
      // Use job quantity or default to 1
      const quantity = originalJob.qty || 1;
      
      // CRITICAL FIX: Look up stage specification from enhanced results
      let stageSpecId = null;
      let stageSpecName = null;
      
      // Try to find stage specification from the result row mappings
      const allRowMappings = Object.values(result.rowMappings).flat();
      const relatedMapping = allRowMappings.find(mapping => 
        mapping.mappedStageId === stageId && !mapping.isUnmapped
      );
      
      if (relatedMapping?.mappedStageSpecId) {
        stageSpecId = relatedMapping.mappedStageSpecId;
        stageSpecName = relatedMapping.mappedStageSpecName;
        this.logger.addDebugInfo(`Found stage specification for ${stage.name}: ${stageSpecName}`);
      }

      // Calculate timing with stage specification inheritance
      const timingResult = await this.calculateStageTimingWithInheritance(
        quantity, 
        stageId, 
        stageSpecId
      );
      
      const { data, error } = await supabase
        .from('job_stage_instances')
        .insert({
          job_id: insertedJob.id,
          job_table_name: 'production_jobs',
          production_stage_id: stageId,
          stage_order: index + 1, // Sequential order based on system ordering
          status: 'pending',
          part_name: `${stage!.name} - User Approved${stageSpecName ? ` (${stageSpecName})` : ''}`,
          part_type: 'user_approved',
          stage_specification_id: stageSpecId, // CRITICAL: Store stage specification
          quantity: quantity,
          estimated_duration_minutes: timingResult.estimatedDuration,
          setup_time_minutes: timingResult.setupTime
        })
        .select('id, production_stage_id, part_name, quantity, estimated_duration_minutes')
        .single();

      if (error) {
        this.logger.addDebugInfo(`Failed to create stage instance for ${stage!.name}: ${error.message}`);
        throw error;
      }

      this.logger.addDebugInfo(`✅ Created stage instance: ${stage!.name} with quantity ${quantity}`);
      return data;
    });

    // Execute all stage creation promises
    const stageInstances = await Promise.all(stageInsertPromises);
    const successfulInstances = stageInstances.filter(instance => instance !== undefined);
    
    this.logger.addDebugInfo(`🎉 USER-APPROVED WORKFLOW SUCCESS: Created ${successfulInstances.length}/${Object.keys(userApprovedStageMappings).length} stage instances from user-approved mappings`);
  }

  /**
   * Get appropriate quantity for a stage instance from mapping or operation quantities
   */
  private getQuantityForStageInstance(mapping: any, job: ParsedJob, instanceIndex: number): number {
    // Try to get quantity from the mapping first
    if (mapping.qty && mapping.qty > 0) {
      return mapping.qty;
    }
    
    if (mapping.woQty && mapping.woQty > 0) {
      return mapping.woQty;
    }

    // Fallback to job quantities
    if (job.qty && job.qty > 0) {
      return job.qty;
    }

    // Try operation quantities
    if (job.operation_quantities) {
      const operations = Object.values(job.operation_quantities);
      if (operations.length > instanceIndex) {
        const operation = operations[instanceIndex] as any;
        if (operation.operation_qty > 0) {
          return operation.operation_qty;
        }
        if (operation.total_wo_qty > 0) {
          return operation.total_wo_qty;
        }
      }
      
      // Use first available operation quantity as fallback
      for (const operation of operations) {
        const opData = operation as any;
        if (opData.operation_qty > 0) {
          return opData.operation_qty;
        }
        if (opData.total_wo_qty > 0) {
          return opData.total_wo_qty;
        }
      }
    }

    // Final fallback
    this.logger.addDebugInfo(`Warning: No quantity found for stage instance, defaulting to 1`);
    return 1;
  }
}