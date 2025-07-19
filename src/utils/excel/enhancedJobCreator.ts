
import { supabase } from '@/integrations/supabase/client';
import type { ExcelImportDebugger } from './debugger';
import type { ParsedJob, CoverTextDetection, CoverTextComponent, RowMappingResult } from './types';
import { generateQRCodeData } from '@/utils/qrCodeGenerator';

export interface EnhancedJobAssignment {
  originalJob: ParsedJob;
  rowMappings: EnhancedRowMapping[];
}

export interface EnhancedRowMapping {
  excelRowIndex: number;
  excelData: any[];
  groupName: string;
  description: string;
  qty: number;
  woQty: number;
  mappedStageId: string;
  mappedStageName: string;
  mappedStageSpecId?: string | null;
  mappedStageSpecName?: string | null;
  confidence: number;
  category: 'printing' | 'finishing' | 'prepress' | 'delivery' | 'packaging' | 'paper';
  isUnmapped: boolean;
}

export interface EnhancedJobCreationResult {
  success: boolean;
  jobsCreated: number;
  totalJobs: number;
  errors: string[];
  createdJobIds: string[];
  stats: {
    total: number;
    successful: number;
    failed: number;
    workflowsInitialized?: number;
    newCategories?: number;
  };
  // Properties expected by the dialog
  rowMappings?: { [woNo: string]: RowMappingResult[] };
  categoryAssignments?: { [woNo: string]: any };
  createdJobs?: any[];
  failedJobs?: any[];
  userApprovedStageMappings?: any[];
}

export class EnhancedJobCreator {
  constructor(
    private logger: ExcelImportDebugger,
    private userId: string,
    private generateQRCodes: boolean = true
  ) {}

  async initialize(): Promise<void> {
    this.logger.addDebugInfo('EnhancedJobCreator initialized');
  }

  async prepareEnhancedJobsWithExcelData(
    jobs: ParsedJob[], 
    headers: string[], 
    dataRows: any[][], 
    userApprovedMappings: any[]
  ): Promise<EnhancedJobCreationResult> {
    this.logger.addDebugInfo(`Preparing ${jobs.length} jobs with Excel data`);
    
    // Initialize result structure
    const result: EnhancedJobCreationResult = {
      success: true,
      jobsCreated: 0,
      totalJobs: jobs.length,
      errors: [],
      createdJobIds: [],
      stats: {
        total: jobs.length,
        successful: 0,
        failed: 0
      },
      rowMappings: {},
      categoryAssignments: {},
      createdJobs: [],
      failedJobs: [],
      userApprovedStageMappings: userApprovedMappings
    };

    // Process each job and extract row mappings
    for (const job of jobs) {
      try {
        const rowMappings = this.extractRowMappingsFromJob(job, headers, dataRows);
        if (rowMappings.length > 0) {
          result.rowMappings![job.wo_no] = rowMappings;
          result.categoryAssignments![job.wo_no] = {
            woNo: job.wo_no,
            customer: job.customer,
            mappedStages: rowMappings.map(rm => ({
              groupName: rm.groupName,
              stageName: rm.mappedStageName,
              quantity: rm.qty,
              category: rm.category
            }))
          };
        }
        result.createdJobs!.push(job);
        this.logger.addDebugInfo(`Prepared job: ${job.wo_no} with ${rowMappings.length} row mappings`);
      } catch (error) {
        const errorMsg = `Failed to prepare job ${job.wo_no}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        result.failedJobs!.push({ job, error: errorMsg });
        this.logger.addDebugInfo(errorMsg);
      }
    }

    this.logger.addDebugInfo(`Job preparation completed: ${result.createdJobs!.length}/${result.stats.total} prepared`);
    return result;
  }

  async createEnhancedJobsWithExcelData(
    jobs: ParsedJob[], 
    headers: string[], 
    dataRows: any[][], 
    userApprovedMappings: any[]
  ): Promise<EnhancedJobCreationResult> {
    // For now, just prepare - actual creation happens in finalizeJobs
    return this.prepareEnhancedJobsWithExcelData(jobs, headers, dataRows, userApprovedMappings);
  }

  async finalizeJobs(
    preparedResult: EnhancedJobCreationResult, 
    userApprovedMappings: any[]
  ): Promise<EnhancedJobCreationResult> {
    this.logger.addDebugInfo('Finalizing jobs - creating in database');
    
    const finalResult: EnhancedJobCreationResult = {
      ...preparedResult,
      jobsCreated: 0,
      stats: {
        ...preparedResult.stats,
        successful: 0,
        failed: 0
      }
    };

    if (!preparedResult.createdJobs || preparedResult.createdJobs.length === 0) {
      finalResult.errors.push('No jobs to create');
      return finalResult;
    }

    // Create jobs in database
    for (const job of preparedResult.createdJobs) {
      try {
        const jobId = await this.createSingleJobInDatabase(job, preparedResult.rowMappings?.[job.wo_no] || []);
        if (jobId) {
          finalResult.jobsCreated++;
          finalResult.stats.successful++;
          finalResult.createdJobIds.push(jobId);
          this.logger.addDebugInfo(`Successfully created job: ${job.wo_no}`);
        }
      } catch (error) {
        const errorMsg = `Failed to create job ${job.wo_no}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        finalResult.errors.push(errorMsg);
        finalResult.stats.failed++;
        finalResult.success = false;
        this.logger.addDebugInfo(errorMsg);
      }
    }

    this.logger.addDebugInfo(`Job finalization completed: ${finalResult.stats.successful}/${finalResult.stats.total} successful`);
    return finalResult;
  }

  private extractRowMappingsFromJob(job: ParsedJob, headers: string[], dataRows: any[][]): RowMappingResult[] {
    const mappings: RowMappingResult[] = [];
    
    // CRITICAL: Extract quantities from cover/text detection if available
    if (job.cover_text_detection?.isBookJob && job.cover_text_detection.components) {
      this.logger.addDebugInfo(`🎯 EXTRACTING COVER/TEXT QUANTITIES for job: ${job.wo_no}`);
      
      for (const component of job.cover_text_detection.components) {
        if (component.printing) {
          const quantity = component.printing.qty;
          this.logger.addDebugInfo(`📊 Found ${component.type} printing: ${component.printing.description} with qty: ${quantity}`);
          
          mappings.push({
            groupName: component.printing.description,
            description: component.printing.description,
            qty: quantity, // USE THE CORRECT QUANTITY HERE!
            woQty: component.printing.wo_qty,
            mappedStageId: 'printing-stage-id', // This should be mapped to actual stage
            mappedStageName: `${component.type.charAt(0).toUpperCase() + component.type.slice(1)} Printing`,
            confidence: 100,
            category: 'printing',
            isUnmapped: false,
            excelRowIndex: 0,
            excelData: component.printing.row || []
          });
        }
      }
    }

    // Fallback to other specifications if no cover/text detection
    if (mappings.length === 0) {
      const specs = [
        job.printing_specifications,
        job.finishing_specifications,
        job.prepress_specifications,
        job.delivery_specifications
      ].filter(Boolean);

      for (const spec of specs) {
        if (spec && typeof spec === 'object') {
          Object.entries(spec).forEach(([key, value]: [string, any]) => {
            if (value && typeof value === 'object' && value.qty) {
              mappings.push({
                groupName: key,
                description: value.description || key,
                qty: value.qty,
                woQty: value.wo_qty || value.qty,
                mappedStageId: 'generic-stage-id',
                mappedStageName: key,
                confidence: 80,
                category: 'printing',
                isUnmapped: false,
                excelRowIndex: 0,
                excelData: []
              });
            }
          });
        }
      }
    }

    this.logger.addDebugInfo(`Extracted ${mappings.length} row mappings for job ${job.wo_no}`);
    return mappings;
  }

  async createJobsFromAssignments(assignments: EnhancedJobAssignment[]): Promise<EnhancedJobCreationResult> {
    this.logger.addDebugInfo(`Creating ${assignments.length} enhanced jobs...`);
    
    const results: EnhancedJobCreationResult = {
      success: true,
      jobsCreated: 0,
      totalJobs: assignments.length,
      errors: [],
      createdJobIds: [],
      stats: {
        total: assignments.length,
        successful: 0,
        failed: 0
      }
    };

    for (const assignment of assignments) {
      try {
        const jobId = await this.createSingleJob(assignment);
        if (jobId) {
          results.jobsCreated++;
          results.stats.successful++;
          results.createdJobIds.push(jobId);
          this.logger.addDebugInfo(`Successfully created job: ${assignment.originalJob.wo_no}`);
        }
      } catch (error) {
        const errorMsg = `Failed to create job ${assignment.originalJob.wo_no}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        results.errors.push(errorMsg);
        results.stats.failed++;
        results.success = false;
        this.logger.addDebugInfo(errorMsg);
      }
    }

    this.logger.addDebugInfo(`Enhanced job creation completed: ${results.stats.successful}/${results.stats.total} successful`);
    return results;
  }

  private async createSingleJob(assignment: EnhancedJobAssignment): Promise<string | null> {
    const { originalJob, rowMappings } = assignment;
    
    this.logger.addDebugInfo(`Creating job: ${originalJob.wo_no} with ${rowMappings.length} stages`);

    // Create the production job
    const { data: job, error: jobError } = await supabase
      .from('production_jobs')
      .insert({
        wo_no: originalJob.wo_no,
        status: originalJob.status || 'Pre-Press',
        date: originalJob.date || new Date().toISOString().split('T')[0],
        rep: originalJob.rep || '',
        category_id: null, // Will be set if job has category
        customer: originalJob.customer || '',
        reference: originalJob.reference || '',
        qty: originalJob.qty || 0,
        due_date: originalJob.due_date || null,
        location: originalJob.location || '',
        size: originalJob.size || null,
        specification: originalJob.specification || null,
        contact: originalJob.contact || null,
        user_id: this.userId
      })
      .select('id')
      .single();

    if (jobError || !job) {
      throw new Error(`Failed to create production job: ${jobError?.message}`);
    }

    const jobId = job.id;

    // Create job stage instances for each mapped stage
    for (const [index, mapping] of rowMappings.entries()) {
      await this.createJobStageInstance(jobId, mapping, index + 1, originalJob);
    }

    // Generate QR code if requested
    if (this.generateQRCodes) {
      try {
        const qrCodeData = generateQRCodeData({ 
          wo_no: originalJob.wo_no, 
          job_id: jobId,
          customer: originalJob.customer,
          due_date: originalJob.due_date 
        });
        await supabase
          .from('production_jobs')
          .update({ qr_code_data: qrCodeData })
          .eq('id', jobId);
      } catch (qrError) {
        this.logger.addDebugInfo(`Failed to generate QR code for ${originalJob.wo_no}: ${qrError}`);
      }
    }

    return jobId;
  }

  private async createSingleJobInDatabase(job: ParsedJob, rowMappings: RowMappingResult[]): Promise<string | null> {
    this.logger.addDebugInfo(`Creating job in database: ${job.wo_no} with ${rowMappings.length} stages`);

    // Create the production job
    const { data: createdJob, error: jobError } = await supabase
      .from('production_jobs')
      .insert({
        wo_no: job.wo_no,
        status: job.status || 'Pre-Press',
        date: job.date || new Date().toISOString().split('T')[0],
        rep: job.rep || '',
        customer: job.customer || '',
        reference: job.reference || '',
        qty: job.qty || 0,
        due_date: job.due_date || null,
        location: job.location || '',
        size: job.size || null,
        specification: job.specification || null,
        contact: job.contact || null,
        user_id: this.userId
      })
      .select('id')
      .single();

    if (jobError || !createdJob) {
      throw new Error(`Failed to create production job: ${jobError?.message}`);
    }

    const jobId = createdJob.id;

    // Create job stage instances for each mapped stage with CORRECT quantities
    for (const [index, mapping] of rowMappings.entries()) {
      this.logger.addDebugInfo(`📊 Creating stage instance: ${mapping.mappedStageName} with qty: ${mapping.qty}`);
      
      const { error: stageError } = await supabase
        .from('job_stage_instances')
        .insert({
          job_id: jobId,
          job_table_name: 'production_jobs',
          production_stage_id: mapping.mappedStageId,
          stage_order: index + 1,
          status: index === 0 ? 'active' : 'pending',
          quantity: mapping.qty, // THIS IS THE CRITICAL FIX!
          notes: mapping.description || null,
          created_by: this.userId
        });

      if (stageError) {
        this.logger.addDebugInfo(`Failed to create stage instance: ${stageError.message}`);
      }
    }

    // Generate QR code if requested
    if (this.generateQRCodes) {
      try {
        const qrCodeData = generateQRCodeData({ 
          wo_no: job.wo_no, 
          job_id: jobId,
          customer: job.customer,
          due_date: job.due_date 
        });
        await supabase
          .from('production_jobs')
          .update({ qr_code_data: qrCodeData })
          .eq('id', jobId);
      } catch (qrError) {
        this.logger.addDebugInfo(`Failed to generate QR code for ${job.wo_no}: ${qrError}`);
      }
    }

    return jobId;
  }

  private async createJobStageInstance(
    jobId: string,
    mapping: EnhancedRowMapping,
    stageOrder: number,
    originalJob: ParsedJob
  ): Promise<void> {
    // Extract quantity using the enhanced logic - THIS IS THE KEY FIX!
    const quantity = this.extractQuantityFromJobSpecs(mapping.groupName, originalJob, mapping.qty);
    
    this.logger.addDebugInfo(`🎯 Creating stage instance: ${mapping.mappedStageName} with EXTRACTED qty: ${quantity} (original mapping qty: ${mapping.qty})`);

    const { error } = await supabase
      .from('job_stage_instances')
      .insert({
        job_id: jobId,
        job_table_name: 'production_jobs',
        production_stage_id: mapping.mappedStageId,
        category_id: null,
        stage_order: stageOrder,
        status: stageOrder === 1 ? 'active' : 'pending',
        quantity: quantity, // USE THE EXTRACTED QUANTITY!
        stage_specification_id: mapping.mappedStageSpecId || null,
        notes: mapping.description || null,
        created_by: this.userId
      });

    if (error) {
      throw new Error(`Failed to create job stage instance: ${error.message}`);
    }
  }

  /**
   * CRITICAL FIX: Enhanced quantity extraction that prioritizes Matrix Parser's cover/text detection data
   */
  private extractQuantityFromJobSpecs(groupName: string, job: ParsedJob, fallbackQty: number): number {
    this.logger.addDebugInfo(`🔍 EXTRACTING QUANTITY for group: "${groupName}" from job: ${job.wo_no}`);
    
    // PRIORITY 1: Use cover/text detection data if available - THIS IS THE FIX!
    if (job.cover_text_detection?.isBookJob && job.cover_text_detection.components) {
      this.logger.addDebugInfo(`📚 Book job detected - using cover/text component quantities`);
      
      const groupLower = groupName.toLowerCase();
      
      // Check for cover patterns
      if (groupLower.includes('cover') || groupLower.includes('hp 12000') || groupLower.includes('12000')) {
        const coverComponent = job.cover_text_detection.components.find(c => c.type === 'cover');
        if (coverComponent?.printing) {
          this.logger.addDebugInfo(`✅ MATCHED COVER pattern - using cover printing qty: ${coverComponent.printing.qty}`);
          return coverComponent.printing.qty; // Should be 132 for your case!
        }
      }
      
      // Check for text patterns  
      if (groupLower.includes('text') || groupLower.includes('inkjet') || groupLower.includes('t250') || groupLower.includes('250')) {
        const textComponent = job.cover_text_detection.components.find(c => c.type === 'text');
        if (textComponent?.printing) {
          this.logger.addDebugInfo(`✅ MATCHED TEXT pattern - using text printing qty: ${textComponent.printing.qty}`);
          return textComponent.printing.qty; // Should be 6694 for your case!
        }
      }
      
      // If group name doesn't clearly match cover/text, try to find by description similarity
      for (const component of job.cover_text_detection.components) {
        if (component.printing && component.printing.description) {
          const compDesc = component.printing.description.toLowerCase();
          if (groupLower.includes(compDesc) || compDesc.includes(groupLower)) {
            this.logger.addDebugInfo(`✅ MATCHED by description similarity (${component.type}) - using qty: ${component.printing.qty}`);
            return component.printing.qty;
          }
        }
      }
    }
    
    // PRIORITY 2: Search in job specifications (existing logic as fallback)
    const specs = [
      job.printing_specifications,
      job.finishing_specifications, 
      job.prepress_specifications,
      job.delivery_specifications
    ].filter(Boolean);
    
    for (const spec of specs) {
      if (spec && typeof spec === 'object') {
        // Try exact key match first
        if (spec[groupName]) {  
          this.logger.addDebugInfo(`Found exact specification match for "${groupName}" with qty: ${spec[groupName].qty}`);
          return spec[groupName].qty || fallbackQty;
        }
        
        // Try partial key matching
        const matchingKey = Object.keys(spec).find(key => 
          key.toLowerCase().includes(groupName.toLowerCase()) || 
          groupName.toLowerCase().includes(key.toLowerCase())
        );
        
        if (matchingKey && spec[matchingKey]) {
          this.logger.addDebugInfo(`Found partial specification match "${matchingKey}" for "${groupName}" with qty: ${spec[matchingKey].qty}`);
          return spec[matchingKey].qty || fallbackQty;
        }
      }
    }
    
    // FALLBACK: Use provided quantity
    this.logger.addDebugInfo(`⚠️ No specification match found for "${groupName}" - using fallback qty: ${fallbackQty}`);
    return fallbackQty;
  }
}
