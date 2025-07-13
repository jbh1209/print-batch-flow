import * as XLSX from "xlsx";
import type { ParsedJob, ImportStats, GroupSpecifications } from './types';
import type { ExcelImportDebugger } from './debugger';
import { formatExcelDate } from './dateFormatter';
import { formatWONumber } from './woNumberFormatter';
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
   * Complete Excel-to-Database pipeline in one function
   */
  async processExcelFile(
    file: File,
    mapping: ColumnMapping
  ): Promise<ProcessingResult> {
    this.logger.addDebugInfo(`Starting unified Excel processing for file: ${file.name}`);

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
      // Step 1: Parse Excel file
      const { jobs, headers, dataRows } = await this.parseExcelFile(file, mapping);
      result.stats.total = jobs.length;

      // Step 2: Process each job individually
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        const excelRow = dataRows[i] || [];

        try {
          // Apply user-approved mappings
          this.applyUserApprovedMappings(job, mapping, excelRow);

          // Create and save job to database
          const savedJob = await this.createJobInDatabase(job);

          // Initialize custom workflow
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
      this.logger.addDebugInfo(`Excel processing completed: ${result.stats.successful}/${result.stats.total} successful`);

    } catch (error) {
      this.logger.addDebugInfo(`Excel processing failed: ${error}`);
      result.success = false;
    }

    return result;
  }

  /**
   * Parse Excel file and extract jobs
   */
  private async parseExcelFile(
    file: File,
    mapping: ColumnMapping
  ): Promise<{ jobs: ParsedJob[]; headers: string[]; dataRows: any[][] }> {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
    
    if (jsonData.length < 2) {
      throw new Error("Excel file appears to be empty or has no data rows");
    }

    const headers = jsonData[0] as string[];
    const dataRows = jsonData.slice(1) as any[][];
    
    this.logger.addDebugInfo(`Parsed Excel: ${headers.length} columns, ${dataRows.length} data rows`);

    const jobs: ParsedJob[] = [];

    dataRows.forEach((row, index) => {
      const woNo = formatWONumber(this.safeGetCellValue(row, mapping.woNo), this.logger);
      
      if (!woNo) {
        this.logger.addDebugInfo(`Skipping row ${index + 2}: Missing WO Number`);
        return;
      }

      const job: ParsedJob = {
        wo_no: woNo,
        status: this.normalizeStatus(this.safeGetCellValue(row, mapping.status)),
        date: formatExcelDate(this.safeGetCellValue(row, mapping.date), this.logger),
        rep: String(this.safeGetCellValue(row, mapping.rep) || "").trim(),
        category: String(this.safeGetCellValue(row, mapping.category) || "").trim(),
        customer: String(this.safeGetCellValue(row, mapping.customer) || "").trim(),
        reference: String(this.safeGetCellValue(row, mapping.reference) || "").trim(),
        qty: parseInt(String(this.safeGetCellValue(row, mapping.qty) || "0").replace(/[^0-9]/g, '')) || 0,
        due_date: formatExcelDate(this.safeGetCellValue(row, mapping.dueDate), this.logger),
        location: String(this.safeGetCellValue(row, mapping.location) || "").trim(),
        // Initialize empty specifications - will be populated by user mappings
        printing_specifications: {},
        finishing_specifications: {},
        prepress_specifications: {},
        paper_specifications: {},
        delivery_specifications: {},
        // Store original Excel row for user mappings
        _originalExcelRow: row,
        _originalRowIndex: index + 1
      };

      jobs.push(job);
    });

    this.logger.addDebugInfo(`Extracted ${jobs.length} valid jobs from Excel`);
    return { jobs, headers, dataRows };
  }

  /**
   * Apply user-approved stage mappings directly to job specifications
   */
  private applyUserApprovedMappings(
    job: ParsedJob,
    mapping: ColumnMapping,
    excelRow: any[]
  ): void {
    this.logger.addDebugInfo(`Applying user-approved mappings for job: ${job.wo_no}`);

    // Extract all user-approved stage mappings
    Object.keys(mapping).forEach(key => {
      if (key.startsWith('user_stage_')) {
        const stageId = key.replace('user_stage_', '');
        const columnIndex = (mapping as any)[key];
        
        if (columnIndex !== -1 && columnIndex !== undefined) {
          const stage = this.productionStages.find(s => s.id === stageId);
          const stageName = stage?.name || 'Unknown Stage';
          
          // Get Excel data for this column
          const columnValue = excelRow[columnIndex] || '';
          
          // CRITICAL: Create ALL user-approved stages regardless of Excel data
          const specificationKey = `user_stage_${stageId}`;
          
          if (!job.printing_specifications) {
            job.printing_specifications = {};
          }

          job.printing_specifications[specificationKey] = {
            description: `User Mapped: ${stageName}`,
            specifications: columnValue || '[User Approved - No Excel Data]',
            qty: job.qty || 1,
            mappedStageId: stageId,
            mappedStageName: stageName,
            originalColumnIndex: columnIndex,
            confidence: 100
          };

          this.logger.addDebugInfo(`Applied user mapping: ${stageName} -> Column ${columnIndex} = "${columnValue || '[No Data]'}"`);
        }
      }
    });

    // Log final specifications
    const userStageCount = Object.keys(job.printing_specifications || {}).filter(k => k.startsWith('user_stage_')).length;
    this.logger.addDebugInfo(`Job ${job.wo_no} has ${userStageCount} user-approved stage mappings`);
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
      // Store all specifications
      printing_specifications: job.printing_specifications || {},
      finishing_specifications: job.finishing_specifications || {},
      prepress_specifications: job.prepress_specifications || {},
      paper_specifications: job.paper_specifications || {},
      delivery_specifications: job.delivery_specifications || {},
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
   * Initialize custom workflow from user-approved mappings
   */
  private async initializeCustomWorkflow(
    savedJob: any,
    originalJob: ParsedJob,
    mapping: ColumnMapping
  ): Promise<void> {
    this.logger.addDebugInfo(`Initializing custom workflow for job: ${savedJob.wo_no}`);

    // Extract user-approved stages
    const userStageIds: string[] = [];
    const userStageOrders: number[] = [];

    Object.keys(mapping).forEach(key => {
      if (key.startsWith('user_stage_')) {
        const stageId = key.replace('user_stage_', '');
        const columnIndex = (mapping as any)[key];
        
        if (columnIndex !== -1 && columnIndex !== undefined) {
          userStageIds.push(stageId);
          userStageOrders.push(userStageIds.length); // Simple sequential ordering
        }
      }
    });

    if (userStageIds.length === 0) {
      this.logger.addDebugInfo(`No user-approved stages found for job: ${savedJob.wo_no}`);
      return;
    }

    // Create custom workflow stages
    try {
      const { data, error } = await supabase.rpc('initialize_custom_job_stages', {
        p_job_id: savedJob.id,
        p_job_table_name: 'production_jobs',
        p_stage_ids: userStageIds,
        p_stage_orders: userStageOrders
      });

      if (error) {
        throw new Error(`Failed to initialize workflow: ${error.message}`);
      }

      this.logger.addDebugInfo(`Created custom workflow with ${userStageIds.length} stages for job: ${savedJob.wo_no}`);
    } catch (error) {
      this.logger.addDebugInfo(`Workflow initialization failed for ${savedJob.wo_no}: ${error}`);
      throw error;
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