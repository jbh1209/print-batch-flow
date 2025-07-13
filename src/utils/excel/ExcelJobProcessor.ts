import * as XLSX from "xlsx";
import type { ParsedJob, ImportStats, GroupSpecifications } from './types';
import type { ExcelImportDebugger } from './debugger';
import { parseExcelFileWithMapping } from './enhancedParser';
import { supabase } from '@/integrations/supabase/client';
import { generateQRCodeData, generateQRCodeImage } from '@/utils/qrCodeGenerator';
import type { ColumnMapping } from '@/components/tracker/ColumnMappingDialog';

export interface ProcessingResult {
  success: boolean;
  createdJobs: any[];
  failedJobs: { job: ParsedJob; error: string }[];
  stats: {
    total: number;
    successful: number;
    failed: number;
    workflowsInitialized: number;
  };
}

/**
 * Single unified Excel-to-Job processor that handles the entire pipeline:
 * 1. Parse Excel file
 * 2. Apply user-approved mappings directly
 * 3. Create jobs with complete specifications
 * 4. Save to database in one transaction
 */
export class ExcelJobProcessor {
  private productionStages: any[] = [];

  constructor(
    private logger: ExcelImportDebugger,
    private userId: string,
    private generateQRCodes: boolean = true
  ) {}

  async initialize(): Promise<void> {
    // Load production stages for user-approved mappings
    const { data: stages } = await supabase
      .from('production_stages')
      .select('*')
      .eq('is_active', true)
      .order('order_index');
    
    this.productionStages = stages || [];
    this.logger.addDebugInfo(`Loaded ${this.productionStages.length} production stages`);
  }

  /**
   * Complete Excel-to-Database pipeline using enhanced parsing
   */
  async processExcelFile(
    file: File,
    mapping: ColumnMapping
  ): Promise<ProcessingResult> {
    this.logger.addDebugInfo(`Starting enhanced Excel processing for file: ${file.name}`);

    const result: ProcessingResult = {
      success: true,
      createdJobs: [],
      failedJobs: [],
      stats: {
        total: 0,
        successful: 0,
        failed: 0,
        workflowsInitialized: 0
      }
    };

    try {
      // Use the sophisticated parsing function that includes specifications
      const { jobs, stats } = await parseExcelFileWithMapping(file, mapping, this.logger, []);
      result.stats.total = jobs.length;

      this.logger.addDebugInfo(`Enhanced parser returned ${jobs.length} jobs with complete specifications`);

      // Step 2: Process each job individually
      for (const job of jobs) {
        try {
          // Apply user-approved stage mappings
          this.applyUserApprovedMappings(job, mapping);

          // Create and save job to database
          const savedJob = await this.createJobInDatabase(job);

          // Initialize custom workflow with user-approved stages
          await this.initializeCustomWorkflow(savedJob, job, mapping);

          result.createdJobs.push(savedJob);
          result.stats.successful++;
          result.stats.workflowsInitialized++;

          this.logger.addDebugInfo(`Successfully processed job: ${job.wo_no}`);
        } catch (error) {
          this.logger.addDebugInfo(`Failed to process job ${job.wo_no}: ${error}`);
          result.failedJobs.push({
            job,
            error: error instanceof Error ? error.message : String(error)
          });
          result.stats.failed++;
        }
      }

      result.success = result.stats.failed === 0;
      this.logger.addDebugInfo(`Enhanced processing completed: ${result.stats.successful}/${result.stats.total} successful`);

    } catch (error) {
      this.logger.addDebugInfo(`Enhanced processing failed: ${error}`);
      result.success = false;
    }

    return result;
  }

  /**
   * Apply user-approved stage mappings to job
   */
  private applyUserApprovedMappings(job: ParsedJob, mapping: ColumnMapping): void {
    // Process stage mappings that start with 'stage_' - enhanced parser handles the parsing,
    // we just ensure the job is marked for custom workflow
    const userStages = Object.entries(mapping).filter(([key]) => key.startsWith('stage_'));
    
    if (userStages.length > 0) {
      this.logger.addDebugInfo(`Job ${job.wo_no} has ${userStages.length} user-approved stage mappings`);
      // Mark job for custom workflow - stages will be initialized separately
      if (!job.operation_quantities) {
        job.operation_quantities = {};
      }
    }
  }

  /**
   * Create job in database with all specifications
   */
  private async createJobInDatabase(job: ParsedJob): Promise<any> {
    this.logger.addDebugInfo(`Creating job in database: ${job.wo_no}`);

    // Generate QR code if enabled
    let qrCodeData = null;
    let qrCodeUrl = null;

    if (this.generateQRCodes) {
      qrCodeData = generateQRCodeData({
        wo_no: job.wo_no,
        job_id: 'temp', // Will be updated after job creation
        customer: job.customer,
        due_date: job.due_date
      });
      try {
        qrCodeUrl = await generateQRCodeImage(qrCodeData);
      } catch (error) {
        this.logger.addDebugInfo(`QR code generation failed for ${job.wo_no}: ${error}`);
      }
    }

    const jobData = {
      wo_no: job.wo_no,
      customer: job.customer || null,
      reference: job.reference || null,
      status: job.status || 'Pre-Press',
      rep: job.rep || null,
      category: job.category || null,
      qty: job.qty || 0,
      date: job.date || null,
      due_date: job.due_date || null,
      location: job.location || null,
      user_id: this.userId,
      has_custom_workflow: true, // All imported jobs use custom workflows
      // Store all specifications from enhanced parser
      printing_specifications: job.printing_specifications || {},
      finishing_specifications: job.finishing_specifications || {},
      prepress_specifications: job.prepress_specifications || {},
      paper_specifications: job.paper_specifications || {},
      delivery_specifications: job.delivery_specifications || {},
      operation_quantities: job.operation_quantities || {},
      qr_code_data: qrCodeData,
      qr_code_url: qrCodeUrl
    };

    // Insert or update job
    const { data: existingJob } = await supabase
      .from('production_jobs')
      .select('id')
      .eq('wo_no', job.wo_no)
      .eq('user_id', this.userId)
      .single();

    if (existingJob) {
      // Update existing job
      const { data: updatedJob, error } = await supabase
        .from('production_jobs')
        .update({
          ...jobData,
          updated_at: new Date().toISOString()
        })
        .eq('wo_no', job.wo_no)
        .eq('user_id', this.userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update job: ${error.message}`);
      }

      this.logger.addDebugInfo(`Updated existing job: ${job.wo_no}`);
      return updatedJob;
    } else {
      // Create new job
      const { data: newJob, error } = await supabase
        .from('production_jobs')
        .insert(jobData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create job: ${error.message}`);
      }

      this.logger.addDebugInfo(`Created new job: ${job.wo_no}`);
      return newJob;
    }
  }

  /**
   * Initialize custom workflow based on user-approved mappings
   */
  private async initializeCustomWorkflow(savedJob: any, originalJob: ParsedJob, mapping: ColumnMapping): Promise<void> {
    // Get user-approved stages from mapping
    const userStages: { stageId: string; order: number }[] = [];
    
    Object.entries(mapping).forEach(([key, columnIndex]) => {
      if (key.startsWith('stage_') && columnIndex && String(columnIndex) !== '') {
        const stageName = key.replace('stage_', '');
        const stage = this.productionStages.find(s => 
          s.name.toLowerCase() === stageName.toLowerCase()
        );
        
        if (stage) {
          userStages.push({
            stageId: stage.id,
            order: userStages.length + 1
          });
          this.logger.addDebugInfo(`Found user-approved stage: ${stageName} -> ${stage.name}`);
        } else {
          this.logger.addDebugInfo(`Warning: Could not find production stage for: ${stageName}`);
        }
      }
    });
    
    if (userStages.length > 0) {
      // Initialize custom workflow
      const { error } = await supabase.rpc('initialize_custom_job_stages', {
        p_job_id: savedJob.id,
        p_job_table_name: 'production_jobs',
        p_stage_ids: userStages.map(s => s.stageId),
        p_stage_orders: userStages.map(s => s.order)
      });
      
      if (error) {
        throw new Error(`Failed to initialize custom workflow: ${error.message}`);
      }
      
      this.logger.addDebugInfo(`✅ Initialized custom workflow with ${userStages.length} user-approved stages`);
    } else {
      this.logger.addDebugInfo(`⚠️ No user-approved stages found in mapping`);
    }
  }

  /**
   * Utility functions
   */
  private safeGetCellValue(row: any[], index: number): any {
    if (index === -1 || !row || index >= row.length) return '';
    const value = row[index];
    return value === null || value === undefined ? '' : value;
  }

  private normalizeStatus(statusValue: any): string {
    const rawStatus = String(statusValue || "").trim();
    
    // Filter out "Production" status as it's just a MIS marker
    if (rawStatus.toLowerCase() === 'production') {
      return "Pre-Press";
    }
    
    return rawStatus || "Pre-Press";
  }
}