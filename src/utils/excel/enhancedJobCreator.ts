
import type { ParsedJob } from './types';
import type { ExcelImportDebugger } from './debugger';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

export class EnhancedJobCreator {
  private logger: ExcelImportDebugger;
  private userId: string;
  private generateQRCodes: boolean;
  private productionStages: any[] = [];

  constructor(logger: ExcelImportDebugger, userId: string, generateQRCodes: boolean = true) {
    this.logger = logger;
    this.userId = userId;
    this.generateQRCodes = generateQRCodes;
  }

  async initialize() {
    // Load production stages for workflow creation
    const { data: stages, error } = await supabase
      .from('production_stages')
      .select('*')
      .order('order_index');
    
    if (error) {
      this.logger.addDebugInfo(`Error loading production stages: ${error.message}`);
      this.productionStages = [];
    } else {
      this.productionStages = stages || [];
      this.logger.addDebugInfo(`Loaded ${this.productionStages.length} production stages`);
    }
  }

  private extractQuantityFromJobSpecs(groupName: string, headers: string[], dataRows: any[][]): number {
    this.logger.addDebugInfo(`🔍 Extracting quantity for group: "${groupName}"`);
    
    // Create a base name by removing paper specifications but preserving _Cover/_Text suffixes
    const baseName = groupName.replace(/\s*-\s*[^_]+$/i, '').trim();
    this.logger.addDebugInfo(`📝 Base name after regex: "${baseName}"`);
    
    // Look for quantity in the data rows for this group
    let totalQuantity = 0;
    
    for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
      const row = dataRows[rowIndex];
      
      // Check if this row contains our group name
      const groupCell = row.find((cell: any) => {
        const cellStr = String(cell || '').trim();
        return cellStr === groupName || cellStr === baseName;
      });
      
      if (groupCell) {
        // Look for quantity in the same row
        for (let colIndex = 0; colIndex < row.length; colIndex++) {
          const cellValue = row[colIndex];
          const numValue = parseInt(String(cellValue || '').replace(/[^0-9]/g, ''));
          
          if (!isNaN(numValue) && numValue > 0 && numValue < 1000000) {
            totalQuantity += numValue;
            this.logger.addDebugInfo(`📊 Found quantity ${numValue} for group "${groupName}" at row ${rowIndex + 1}, col ${colIndex + 1}`);
          }
        }
      }
    }
    
    this.logger.addDebugInfo(`📈 Total quantity for group "${groupName}": ${totalQuantity}`);
    return totalQuantity || 1; // Default to 1 if no quantity found
  }

  async prepareEnhancedJobsWithExcelData(
    jobs: ParsedJob[], 
    headers: string[], 
    dataRows: any[][],
    userApprovedStageMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
  ): Promise<any> {
    this.logger.addDebugInfo(`🚀 Preparing ${jobs.length} enhanced jobs with Excel data`);
    
    const preparedJobs = [];
    const stats = {
      total: jobs.length,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const job of jobs) {
      try {
        // Extract quantity from Excel data if available
        const extractedQty = this.extractQuantityFromJobSpecs(
          job.reference || job.wo_no, 
          headers, 
          dataRows
        );
        
        const preparedJob = {
          ...job,
          qty: job.qty || extractedQty,
          id: uuidv4(),
          created_by: this.userId,
          // Store Excel data for later use
          _excelHeaders: headers,
          _excelDataRows: dataRows,
          _userApprovedStageMappings: userApprovedStageMappings
        };

        preparedJobs.push(preparedJob);
        stats.successful++;
        
      } catch (error) {
        const errorMsg = `Failed to prepare job ${job.wo_no}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        this.logger.addDebugInfo(errorMsg);
        stats.errors.push(errorMsg);
        stats.failed++;
      }
    }

    this.logger.addDebugInfo(`✅ Job preparation completed: ${stats.successful}/${stats.total} jobs prepared`);
    
    return {
      jobs: preparedJobs,
      stats,
      generateQRCodes: this.generateQRCodes,
      userApprovedStageMappings
    };
  }

  async createEnhancedJobsWithExcelData(
    jobs: ParsedJob[], 
    headers: string[], 
    dataRows: any[][]
  ): Promise<any> {
    this.logger.addDebugInfo(`🚀 Creating ${jobs.length} enhanced jobs with Excel data`);
    
    const createdJobs = [];
    const stats = {
      total: jobs.length,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const job of jobs) {
      try {
        // Extract quantity from Excel data if available
        const extractedQty = this.extractQuantityFromJobSpecs(
          job.reference || job.wo_no, 
          headers, 
          dataRows
        );
        
        // Create the job record
        const { data: createdJob, error: jobError } = await supabase
          .from('production_jobs')
          .insert({
            wo_no: job.wo_no,
            status: job.status || 'Pre-Press',
            date: job.date,
            rep: job.rep,
            category_id: job.category_id,
            customer: job.customer,
            reference: job.reference,
            qty: job.qty || extractedQty,
            due_date: job.due_date,
            location: job.location,
            estimated_hours: job.estimated_hours,
            setup_time_minutes: job.setup_time_minutes,
            running_speed: job.running_speed,
            speed_unit: job.speed_unit,
            specifications: job.specifications,
            paper_weight: job.paper_weight,
            paper_type: job.paper_type,
            lamination: job.lamination,
            created_by: this.userId
          })
          .select()
          .single();

        if (jobError) {
          throw new Error(`Database error: ${jobError.message}`);
        }

        // Create workflow stages for the job
        await this.createWorkflowStages(createdJob.id);

        // Generate QR code if requested
        if (this.generateQRCodes) {
          await this.generateQRCode(createdJob.id, job.wo_no);
        }

        createdJobs.push(createdJob);
        stats.successful++;
        
      } catch (error) {
        const errorMsg = `Failed to create job ${job.wo_no}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        this.logger.addDebugInfo(errorMsg);
        stats.errors.push(errorMsg);
        stats.failed++;
      }
    }

    this.logger.addDebugInfo(`✅ Job creation completed: ${stats.successful}/${stats.total} jobs created`);
    
    return {
      jobs: createdJobs,
      stats
    };
  }

  async finalizeJobs(
    preparedResult: any,
    userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
  ): Promise<any> {
    this.logger.addDebugInfo(`🎯 Finalizing ${preparedResult.jobs.length} prepared jobs`);
    
    const createdJobs = [];
    const stats = {
      total: preparedResult.jobs.length,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const job of preparedResult.jobs) {
      try {
        // Create the job record
        const { data: createdJob, error: jobError } = await supabase
          .from('production_jobs')
          .insert({
            wo_no: job.wo_no,
            status: job.status || 'Pre-Press',
            date: job.date,
            rep: job.rep,
            category_id: job.category_id,
            customer: job.customer,
            reference: job.reference,
            qty: job.qty,
            due_date: job.due_date,
            location: job.location,
            estimated_hours: job.estimated_hours,
            setup_time_minutes: job.setup_time_minutes,
            running_speed: job.running_speed,
            speed_unit: job.speed_unit,
            specifications: job.specifications,
            paper_weight: job.paper_weight,
            paper_type: job.paper_type,
            lamination: job.lamination,
            created_by: this.userId
          })
          .select()
          .single();

        if (jobError) {
          throw new Error(`Database error: ${jobError.message}`);
        }

        // Create workflow stages for the job
        await this.createWorkflowStages(createdJob.id, userApprovedMappings);

        // Generate QR code if requested
        if (preparedResult.generateQRCodes) {
          await this.generateQRCode(createdJob.id, job.wo_no);
        }

        createdJobs.push(createdJob);
        stats.successful++;
        
      } catch (error) {
        const errorMsg = `Failed to finalize job ${job.wo_no}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        this.logger.addDebugInfo(errorMsg);
        stats.errors.push(errorMsg);
        stats.failed++;
      }
    }

    this.logger.addDebugInfo(`✅ Job finalization completed: ${stats.successful}/${stats.total} jobs saved`);
    
    return {
      jobs: createdJobs,
      stats
    };
  }

  private async createWorkflowStages(
    jobId: string,
    userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
  ) {
    if (this.productionStages.length === 0) {
      this.logger.addDebugInfo(`No production stages available for job ${jobId}`);
      return;
    }

    const workflowStages = this.productionStages.map((stage, index) => ({
      job_id: jobId,
      stage_id: stage.id,
      stage_name: stage.name,
      order_index: stage.order_index,
      status: index === 0 ? 'pending' : 'not_started',
      estimated_duration: stage.default_duration || 60
    }));

    const { error } = await supabase
      .from('job_stage_instances')
      .insert(workflowStages);

    if (error) {
      this.logger.addDebugInfo(`Error creating workflow stages for job ${jobId}: ${error.message}`);
    } else {
      this.logger.addDebugInfo(`Created ${workflowStages.length} workflow stages for job ${jobId}`);
    }
  }

  private async generateQRCode(jobId: string, woNo: string) {
    try {
      // Generate QR code data
      const qrData = {
        jobId,
        woNo,
        timestamp: new Date().toISOString()
      };

      // Store QR code reference in database
      const { error } = await supabase
        .from('job_qr_codes')
        .insert({
          job_id: jobId,
          qr_data: JSON.stringify(qrData),
          created_by: this.userId
        });

      if (error) {
        this.logger.addDebugInfo(`Error generating QR code for job ${woNo}: ${error.message}`);
      } else {
        this.logger.addDebugInfo(`Generated QR code for job ${woNo}`);
      }
    } catch (error) {
      this.logger.addDebugInfo(`Failed to generate QR code for job ${woNo}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
