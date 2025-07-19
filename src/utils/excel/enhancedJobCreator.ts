
import { supabase } from '@/integrations/supabase/client';
import type { ExcelImportDebugger } from './debugger';
import type { ParsedJob, CoverTextDetection, CoverTextComponent } from './types';
import { generateQRCode } from '@/utils/qrCodeGenerator';

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
  };
}

export class EnhancedJobCreator {
  constructor(
    private logger: ExcelImportDebugger,
    private userId: string,
    private generateQRCodes: boolean = true
  ) {}

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
        category_id: originalJob.category_id || null,
        customer: originalJob.customer || '',
        reference: originalJob.reference || '',
        qty: originalJob.qty || 0,
        due_date: originalJob.due_date || null,
        location: originalJob.location || '',
        size: originalJob.size || null,
        specification: originalJob.specification || null,
        contact: originalJob.contact || null,
        created_by: this.userId
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
        const qrCodeData = await generateQRCode(originalJob.wo_no);
        await supabase
          .from('production_jobs')
          .update({ qr_code: qrCodeData })
          .eq('id', jobId);
      } catch (qrError) {
        this.logger.addDebugInfo(`Failed to generate QR code for ${originalJob.wo_no}: ${qrError}`);
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
    // Extract quantity using the enhanced logic
    const quantity = this.extractQuantityFromJobSpecs(mapping.groupName, originalJob, mapping.qty);
    
    this.logger.addDebugInfo(`Creating stage instance: ${mapping.mappedStageName} with qty: ${quantity} (original mapping qty: ${mapping.qty})`);

    const { error } = await supabase
      .from('job_stage_instances')
      .insert({
        job_id: jobId,
        job_table_name: 'production_jobs',
        production_stage_id: mapping.mappedStageId,
        category_id: null,
        stage_order: stageOrder,
        status: stageOrder === 1 ? 'active' : 'pending',
        quantity: quantity,
        stage_specification_id: mapping.mappedStageSpecId || null,
        notes: mapping.description || null,
        created_by: this.userId
      });

    if (error) {
      throw new Error(`Failed to create job stage instance: ${error.message}`);
    }
  }

  /**
   * FIXED: Enhanced quantity extraction that prioritizes Matrix Parser's cover/text detection data
   */
  private extractQuantityFromJobSpecs(groupName: string, job: ParsedJob, fallbackQty: number): number {
    this.logger.addDebugInfo(`Extracting quantity for group: "${groupName}" from job: ${job.wo_no}`);
    
    // PRIORITY 1: Use cover/text detection data if available
    if (job.cover_text_detection?.isBookJob && job.cover_text_detection.components) {
      this.logger.addDebugInfo(`Book job detected - using cover/text component quantities`);
      
      const groupLower = groupName.toLowerCase();
      
      // Check for cover patterns
      if (groupLower.includes('cover') || groupLower.includes('hp 12000') || groupLower.includes('12000')) {
        const coverComponent = job.cover_text_detection.components.find(c => c.type === 'cover');
        if (coverComponent?.printing) {
          this.logger.addDebugInfo(`Matched cover pattern - using cover printing qty: ${coverComponent.printing.qty}`);
          return coverComponent.printing.qty;
        }
      }
      
      // Check for text patterns  
      if (groupLower.includes('text') || groupLower.includes('inkjet') || groupLower.includes('t250') || groupLower.includes('250')) {
        const textComponent = job.cover_text_detection.components.find(c => c.type === 'text');
        if (textComponent?.printing) {
          this.logger.addDebugInfo(`Matched text pattern - using text printing qty: ${textComponent.printing.qty}`);
          return textComponent.printing.qty;
        }
      }
      
      // If group name doesn't clearly match cover/text, try to find by description similarity
      for (const component of job.cover_text_detection.components) {
        if (component.printing && component.printing.description) {
          const compDesc = component.printing.description.toLowerCase();
          if (groupLower.includes(compDesc) || compDesc.includes(groupLower)) {
            this.logger.addDebugInfo(`Matched by description similarity (${component.type}) - using qty: ${component.printing.qty}`);
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
    this.logger.addDebugInfo(`No specification match found for "${groupName}" - using fallback qty: ${fallbackQty}`);
    return fallbackQty;
  }
}
