import { supabase } from '@/integrations/supabase/client';
import type { ParsedJob, RowMappingResult } from './types';
import type { ExcelImportDebugger } from './debugger';
import { generateQRCode } from '@/utils/qrCode';

export class EnhancedJobCreator {
  private logger: ExcelImportDebugger;
  private userId: string;
  private generateQRCodes: boolean;
  private productionStages: any[] = [];
  private stageSpecifications: any[] = [];

  constructor(logger: ExcelImportDebugger, userId: string, generateQRCodes: boolean = true) {
    this.logger = logger;
    this.userId = userId;
    this.generateQRCodes = generateQRCodes;
  }

  async initialize() {
    this.logger.addDebugInfo('🚀 Initializing EnhancedJobCreator...');
    
    // Load production stages and specifications
    const { data: stages, error: stagesError } = await supabase
      .from('production_stages')
      .select('*')
      .order('order_index');
    
    if (stagesError) {
      this.logger.addDebugInfo(`❌ Error loading production stages: ${stagesError.message}`);
      throw stagesError;
    }
    
    this.productionStages = stages || [];
    this.logger.addDebugInfo(`✅ Loaded ${this.productionStages.length} production stages`);
    
    // Load stage specifications
    const { data: specs, error: specsError } = await supabase
      .from('stage_specifications')
      .select('*');
    
    if (specsError) {
      this.logger.addDebugInfo(`❌ Error loading stage specifications: ${specsError.message}`);
      throw specsError;
    }
    
    this.stageSpecifications = specs || [];
    this.logger.addDebugInfo(`✅ Loaded ${this.stageSpecifications.length} stage specifications`);
  }

  /**
   * Enhanced quantity extraction that handles both original and enhanced group names
   */
  private extractQuantityFromJobSpecs(job: ParsedJob, groupName: string, specificationName: string): number {
    this.logger.addDebugInfo(`🔍 Extracting quantity for group: "${groupName}", spec: "${specificationName}"`);
    
    // For cover/text jobs, prioritize direct component extraction
    if (job.cover_text_detection?.isBookJob && job.cover_text_detection.components) {
      this.logger.addDebugInfo(`📖 Cover/text job detected, checking components...`);
      
      for (const component of job.cover_text_detection.components) {
        const printingDesc = component.printing?.description || '';
        this.logger.addDebugInfo(`   - Component printing desc: "${printingDesc}"`);
        
        // Check if the group name matches or starts with the printing description
        if (groupName === printingDesc || groupName.startsWith(printingDesc)) {
          const qty = component.printing?.qty || 0;
          this.logger.addDebugInfo(`✅ Found matching component quantity: ${qty}`);
          return qty;
        }
      }
    }

    // Try to find exact group name match first
    if (job.printing_specifications && job.printing_specifications[groupName]) {
      const qty = job.printing_specifications[groupName].qty || 0;
      this.logger.addDebugInfo(`✅ Found exact group match quantity: ${qty}`);
      return qty;
    }

    // Handle enhanced group names (format: "Original Description - Paper Spec")
    if (groupName.includes(' - ')) {
      const originalPrintingDesc = groupName.split(' - ')[0].trim();
      this.logger.addDebugInfo(`🔧 Enhanced group detected, extracted printing desc: "${originalPrintingDesc}"`);
      
      // For cover/text jobs, check components with the extracted description
      if (job.cover_text_detection?.isBookJob && job.cover_text_detection.components) {
        for (const component of job.cover_text_detection.components) {
          const printingDesc = component.printing?.description || '';
          if (printingDesc === originalPrintingDesc || printingDesc.startsWith(originalPrintingDesc)) {
            const qty = component.printing?.qty || 0;
            this.logger.addDebugInfo(`✅ Found enhanced group component match quantity: ${qty}`);
            return qty;
          }
        }
      }
      
      // Try to find the original printing description in specifications
      if (job.printing_specifications && job.printing_specifications[originalPrintingDesc]) {
        const qty = job.printing_specifications[originalPrintingDesc].qty || 0;
        this.logger.addDebugInfo(`✅ Found enhanced group spec match quantity: ${qty}`);
        return qty;
      }
    }

    // Fallback: try to find any specification that contains part of the group name
    if (job.printing_specifications) {
      for (const [specKey, specData] of Object.entries(job.printing_specifications)) {
        if (groupName.includes(specKey) || specKey.includes(groupName.split(' - ')[0])) {
          const qty = specData.qty || 0;
          this.logger.addDebugInfo(`⚠️ Found partial match quantity: ${qty} for spec: "${specKey}"`);
          return qty;
        }
      }
    }

    // Last resort: check other specification groups
    const allSpecs = [
      job.paper_specifications,
      job.finishing_specifications,
      job.delivery_specifications,
      job.prepress_specifications,
      job.packaging_specifications
    ];

    for (const specs of allSpecs) {
      if (specs && specs[groupName]) {
        const qty = specs[groupName].qty || 0;
        this.logger.addDebugInfo(`⚠️ Found fallback quantity: ${qty} from other specifications`);
        return qty;
      }
    }

    // Final fallback to job quantity
    const jobQty = job.qty || 0;
    this.logger.addDebugInfo(`⚠️ Using job quantity fallback: ${jobQty}`);
    return jobQty;
  }

  /**
   * Create production-ready jobs with workflows and save to database
   */
  async createEnhancedJobsWithExcelData(
    jobs: ParsedJob[], 
    headers: string[], 
    dataRows: any[][],
    userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
  ): Promise<any> {
    this.logger.addDebugInfo(`🏭 Creating ${jobs.length} enhanced production-ready jobs with Excel data`);
    
    const result = await this.prepareEnhancedJobsWithExcelData(jobs, headers, dataRows, userApprovedMappings);
    
    // Now save to database
    return await this.finalizeJobs(result, userApprovedMappings);
  }

  /**
   * Prepare production-ready jobs with workflows (no database saves)
   */
  async prepareEnhancedJobsWithExcelData(
    jobs: ParsedJob[], 
    headers: string[], 
    dataRows: any[][],
    userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
  ): Promise<any> {
    this.logger.addDebugInfo(`🔧 Preparing ${jobs.length} enhanced jobs with Excel data for review`);
    
    const preparedJobs = [];
    const stats = {
      total: jobs.length,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const job of jobs) {
      try {
        const preparedJob = await this.prepareEnhancedJob(job, headers, dataRows, userApprovedMappings);
        preparedJobs.push(preparedJob);
        stats.successful++;
      } catch (error) {
        this.logger.addDebugInfo(`❌ Failed to prepare job ${job.wo_no}: ${error}`);
        stats.failed++;
        stats.errors.push(`Job ${job.wo_no}: ${error}`);
      }
    }

    this.logger.addDebugInfo(`✅ Job preparation completed: ${stats.successful}/${stats.total} jobs prepared`);

    return {
      preparedJobs,
      stats,
      generateQRCodes: this.generateQRCodes,
      userId: this.userId
    };
  }

  /**
   * Finalize prepared jobs by saving to database
   */
  async finalizeJobs(
    preparedResult: any,
    userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
  ): Promise<any> {
    this.logger.addDebugInfo(`💾 Finalizing ${preparedResult.preparedJobs.length} prepared jobs`);
    
    const createdJobs = [];
    const stats = {
      total: preparedResult.preparedJobs.length,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const preparedJob of preparedResult.preparedJobs) {
      try {
        const createdJob = await this.saveJobToDatabase(preparedJob);
        createdJobs.push(createdJob);
        stats.successful++;
      } catch (error) {
        this.logger.addDebugInfo(`❌ Failed to save job ${preparedJob.wo_no}: ${error}`);
        stats.failed++;
        stats.errors.push(`Job ${preparedJob.wo_no}: ${error}`);
      }
    }

    this.logger.addDebugInfo(`✅ Job finalization completed: ${stats.successful}/${stats.total} jobs saved`);

    return {
      jobs: createdJobs,
      stats,
      errors: stats.errors
    };
  }

  private async prepareEnhancedJob(
    job: ParsedJob, 
    headers: string[], 
    dataRows: any[][],
    userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
  ): Promise<any> {
    this.logger.addDebugInfo(`🔧 Preparing enhanced job: ${job.wo_no}`);

    // Generate QR code if enabled
    let qrCodeUrl = null;
    if (this.generateQRCodes) {
      try {
        qrCodeUrl = await generateQRCode(job.wo_no);
        this.logger.addDebugInfo(`✅ Generated QR code for job ${job.wo_no}`);
      } catch (error) {
        this.logger.addDebugInfo(`⚠️ Failed to generate QR code for job ${job.wo_no}: ${error}`);
      }
    }

    // Prepare base job data
    const baseJob = {
      wo_no: job.wo_no,
      status: job.status || 'Pre-Press',
      date: job.date,
      rep: job.rep,
      category: job.category,
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
      size: job.size,
      specification: job.specification,
      contact: job.contact,
      qr_code_url: qrCodeUrl,
      created_by: this.userId
    };

    // Prepare workflow stages
    const workflowStages = await this.prepareWorkflowStages(job, userApprovedMappings);

    return {
      ...baseJob,
      workflowStages
    };
  }

  private async saveJobToDatabase(preparedJob: any): Promise<any> {
    this.logger.addDebugInfo(`💾 Saving job to database: ${preparedJob.wo_no}`);

    // Save main job record
    const { data: jobData, error: jobError } = await supabase
      .from('production_jobs')
      .insert({
        wo_no: preparedJob.wo_no,
        status: preparedJob.status,
        date: preparedJob.date,
        rep: preparedJob.rep,
        category: preparedJob.category,
        customer: preparedJob.customer,
        reference: preparedJob.reference,
        qty: preparedJob.qty,
        due_date: preparedJob.due_date,
        location: preparedJob.location,
        estimated_hours: preparedJob.estimated_hours,
        setup_time_minutes: preparedJob.setup_time_minutes,
        running_speed: preparedJob.running_speed,
        speed_unit: preparedJob.speed_unit,
        specifications: preparedJob.specifications,
        paper_weight: preparedJob.paper_weight,
        paper_type: preparedJob.paper_type,
        lamination: preparedJob.lamination,
        size: preparedJob.size,
        specification: preparedJob.specification,
        contact: preparedJob.contact,
        qr_code_url: preparedJob.qr_code_url,
        created_by: preparedJob.created_by
      })
      .select()
      .single();

    if (jobError) {
      throw new Error(`Failed to create job: ${jobError.message}`);
    }

    // Save workflow stages
    if (preparedJob.workflowStages && preparedJob.workflowStages.length > 0) {
      const stageInserts = preparedJob.workflowStages.map((stage: any) => ({
        job_id: jobData.id,
        stage_id: stage.stage_id,
        stage_spec_id: stage.stage_spec_id,
        status: 'pending',
        order_index: stage.order_index,
        quantity: stage.quantity,
        specifications: stage.specifications,
        created_by: preparedJob.created_by
      }));

      const { error: stagesError } = await supabase
        .from('job_stages')
        .insert(stageInserts);

      if (stagesError) {
        this.logger.addDebugInfo(`⚠️ Failed to create workflow stages for job ${preparedJob.wo_no}: ${stagesError.message}`);
      } else {
        this.logger.addDebugInfo(`✅ Created ${stageInserts.length} workflow stages for job ${preparedJob.wo_no}`);
      }
    }

    this.logger.addDebugInfo(`✅ Successfully saved job: ${preparedJob.wo_no}`);
    return jobData;
  }

  private async prepareWorkflowStages(
    job: ParsedJob,
    userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
  ): Promise<any[]> {
    this.logger.addDebugInfo(`🔄 Preparing workflow stages for job: ${job.wo_no}`);

    const stages = [];
    let orderIndex = 0;

    // Process user-approved mappings first
    if (userApprovedMappings && userApprovedMappings.length > 0) {
      this.logger.addDebugInfo(`👤 Processing ${userApprovedMappings.length} user-approved stage mappings`);
      
      for (const mapping of userApprovedMappings) {
        const stage = this.productionStages.find(s => s.id === mapping.mappedStageId);
        if (stage) {
          const quantity = this.extractQuantityFromJobSpecs(job, mapping.groupName, '');
          
          stages.push({
            stage_id: mapping.mappedStageId,
            stage_spec_id: null,
            order_index: orderIndex++,
            quantity: quantity,
            specifications: mapping.groupName
          });
          
          this.logger.addDebugInfo(`✅ Added user-approved stage: ${mapping.mappedStageName} (qty: ${quantity})`);
        }
      }
    }

    // Process automatic mappings from job specifications
    const specGroups = [
      { specs: job.printing_specifications, category: 'printing' },
      { specs: job.finishing_specifications, category: 'finishing' },
      { specs: job.prepress_specifications, category: 'prepress' },
      { specs: job.delivery_specifications, category: 'delivery' },
      { specs: job.packaging_specifications, category: 'packaging' }
    ];

    for (const group of specGroups) {
      if (group.specs) {
        for (const [specName, specData] of Object.entries(group.specs)) {
          // Skip if already handled by user-approved mappings
          const alreadyMapped = userApprovedMappings?.some(m => m.groupName === specName);
          if (alreadyMapped) {
            this.logger.addDebugInfo(`⏭️ Skipping ${specName} - already mapped by user`);
            continue;
          }

          // Find matching production stage
          const matchingStage = this.findMatchingStage(specName, group.category);
          if (matchingStage) {
            const quantity = this.extractQuantityFromJobSpecs(job, specName, specName);
            
            stages.push({
              stage_id: matchingStage.id,
              stage_spec_id: null,
              order_index: orderIndex++,
              quantity: quantity,
              specifications: specName
            });
            
            this.logger.addDebugInfo(`✅ Added auto-mapped stage: ${matchingStage.name} (qty: ${quantity})`);
          }
        }
      }
    }

    this.logger.addDebugInfo(`🔄 Prepared ${stages.length} workflow stages for job: ${job.wo_no}`);
    return stages;
  }

  private findMatchingStage(specName: string, category: string): any | null {
    // Simple matching logic - can be enhanced
    const lowerSpecName = specName.toLowerCase();
    
    return this.productionStages.find(stage => {
      const lowerStageName = stage.name.toLowerCase();
      return lowerStageName.includes(lowerSpecName) || lowerSpecName.includes(lowerStageName);
    });
  }
}
