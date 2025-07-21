import { supabase } from '@/integrations/supabase/client';
import type { ExcelImportDebugger } from '@/utils/excel/debugger';
import type { ParsedJob } from '@/utils/excel/types';

export class EnhancedJobCreator {
  constructor(private logger: ExcelImportDebugger, private userId: string) {}

  async createEnhancedJobs(preparedResult: any): Promise<any> {
    const result = {
      success: true,
      createdJobs: [],
      failedJobs: [],
      stats: {
        total: Object.keys(preparedResult.categoryAssignments || {}).length,
        successful: 0,
        failed: 0
      }
    };

    this.logger.addDebugInfo(`Creating ${result.stats.total} enhanced jobs`);

    for (const [woNo, assignment] of Object.entries(preparedResult.categoryAssignments || {})) {
      try {
        const originalJob = (assignment as any).originalJob;
        if (!originalJob) {
          throw new Error(`No original job data found for ${woNo}`);
        }

        const createdJob = await this.createSingleEnhancedJob(originalJob, preparedResult.rowMappings[woNo] || []);
        result.createdJobs.push(createdJob);
        result.stats.successful++;
      } catch (error) {
        this.logger.addDebugInfo(`Failed to create enhanced job ${woNo}: ${error}`);
        const originalJob = (preparedResult.categoryAssignments[woNo] as any)?.originalJob;
        result.failedJobs.push({
          job: originalJob || { wo_no: woNo } as ParsedJob,
          error: error instanceof Error ? error.message : String(error)
        });
        result.stats.failed++;
      }
    }

    result.success = result.stats.failed === 0;
    this.logger.addDebugInfo(`Enhanced job creation completed: ${result.stats.successful}/${result.stats.total} successful`);

    return result;
  }

  private async createSingleEnhancedJob(originalJob: ParsedJob, rowMappings: any[]): Promise<any> {
    const jobData = {
      wo_no: originalJob.wo_no,
      customer: originalJob.customer || 'Imported Customer',
      reference: originalJob.reference || '',
      qty: originalJob.qty || 1,
      due_date: originalJob.due_date,
      user_id: this.userId,
      status: 'Pre-Press',
      has_custom_workflow: true,
      paper_specifications: originalJob.paper_specifications || {},
      printing_specifications: originalJob.printing_specifications || {},
      finishing_specifications: originalJob.finishing_specifications || {},
      prepress_specifications: originalJob.prepress_specifications || {},
      delivery_specifications: originalJob.delivery_specifications || {}
    };

    const { data: insertedJob, error: insertError } = await supabase
      .from('production_jobs')
      .insert(jobData)
      .select()
      .single();

    if (insertError) {
      throw new Error(`Database insertion failed: ${insertError.message}`);
    }

    if (!insertedJob) {
      throw new Error('Job creation returned no data');
    }

    await this.initializeWorkflowFromMappings(insertedJob, rowMappings, originalJob);

    return insertedJob;
  }

  private async initializeWorkflowFromMappings(job: any, rowMappings: any[], originalJob: ParsedJob): Promise<void> {
    if (!rowMappings || rowMappings.length === 0) {
      this.logger.addDebugInfo(`No row mappings found for job ${job.wo_no}, skipping workflow initialization`);
      return;
    }

    this.logger.addDebugInfo(`Initializing workflow for job ${job.wo_no} with ${rowMappings.length} row mappings`);

    for (const mapping of rowMappings) {
      if (!mapping.mappedStageId) continue;

      let quantity = mapping.qty || 100;

      if (mapping.mappedStageName?.toLowerCase().includes('printing')) {
        quantity = this.extractQuantityFromJobSpecs(originalJob, mapping.mappedStageName) || quantity;
      }

      const { error } = await supabase
        .from('job_stage_instances')
        .insert({
          job_id: job.id,
          job_table_name: 'production_jobs',
          category_id: null, // Custom workflow
          production_stage_id: mapping.mappedStageId,
          stage_order: mapping.orderIndex || 1,
          status: 'pending',
          quantity: quantity
        });

      if (error) {
        throw new Error(`Failed to create stage instance for ${mapping.mappedStageName}: ${error.message}`);
      }
    }

    await supabase
      .from('job_stage_instances')
      .update({ status: 'pending' })
      .eq('job_id', job.id)
      .eq('job_table_name', 'production_jobs');
  }

  /**
   * Extract quantity from job specifications by matching group names
   * Enhanced to handle paper specification suffixes like "- Gloss 250gsm"
   */
  private extractQuantityFromJobSpecs(job: any, groupName: string): number | null {
    this.logger.addDebugInfo(`🔍 Extracting quantity for group: "${groupName}"`);
    
    // Create base name by removing paper specification suffixes (everything after " - ")
    const baseName = groupName.replace(/\s*-\s*.+$/i, '').trim();
    this.logger.addDebugInfo(`🔍 Base name after removing suffix: "${baseName}"`);
    
    // Look through all specification categories for quantity data
    const specCategories = [
      { name: 'printing', specs: job.printing_specifications },
      { name: 'finishing', specs: job.finishing_specifications },
      { name: 'prepress', specs: job.prepress_specifications },
      { name: 'paper', specs: job.paper_specifications },
      { name: 'delivery', specs: job.delivery_specifications }
    ];

    for (const category of specCategories) {
      if (!category.specs) continue;
      
      const availableKeys = Object.keys(category.specs);
      this.logger.addDebugInfo(`🔍 Available ${category.name} specs: [${availableKeys.map(k => `"${k}"`).join(', ')}]`);
      
      // Debug: Show the exact characters in each key for printing specs
      if (category.name === 'printing') {
        availableKeys.forEach(key => {
          this.logger.addDebugInfo(`🔍 PRINTING KEY: "${key}" (length: ${key.length}) chars: [${key.split('').map(c => c.charCodeAt(0)).join(', ')}]`);
        });
        this.logger.addDebugInfo(`🔍 GROUP NAME: "${groupName}" (length: ${groupName.length}) chars: [${groupName.split('').map(c => c.charCodeAt(0)).join(', ')}]`);
        this.logger.addDebugInfo(`🔍 BASE NAME: "${baseName}" (length: ${baseName.length}) chars: [${baseName.split('').map(c => c.charCodeAt(0)).join(', ')}]`);
      }
      
      // Try exact match first with original group name
      if (category.specs[groupName]) {
        const qty = category.specs[groupName].qty || null;
        this.logger.addDebugInfo(`✅ Found exact match for "${groupName}" in ${category.name}: qty=${qty}`);
        return qty;
      }
      
      // Try exact match with base name (after removing paper suffix)
      if (category.specs[baseName]) {
        const qty = category.specs[baseName].qty || null;
        this.logger.addDebugInfo(`✅ Found exact match for "${baseName}" in ${category.name}: qty=${qty}`);
        return qty;
      }
      
      // Try partial matching (case insensitive)
      for (const [specKey, specData] of Object.entries(category.specs)) {
        if (specKey.toLowerCase().includes(groupName.toLowerCase()) || 
            groupName.toLowerCase().includes(specKey.toLowerCase())) {
          const qty = (specData as any).qty || null;
          this.logger.addDebugInfo(`✅ Found partial match for "${groupName}" -> "${specKey}" in ${category.name}: qty=${qty}`);
          return qty;
        }
      }
    }

    this.logger.addDebugInfo(`⚠️ No quantity found for group "${groupName}", using job default: ${job.qty || 100}`);
    return job.qty || 100;
  }
}
