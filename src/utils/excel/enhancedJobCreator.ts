import { supabase } from "@/integrations/supabase/client";
import { ParsedJob } from './types';
import { ExcelImportDebugger } from './debugger';
import QRCode from 'qrcode';
// import { TimingCalculationService } from './timingCalculation';

export interface EnhancedJobCreationResult {
  jobs: ParsedJob[];
  rowMappings: Record<string, Array<{
    groupName: string;
    mappedStageId: string;
    mappedStageName: string;
    category: string;
    qty?: number;
    isUnmapped?: boolean;
    confidence?: number;
    manualOverride?: boolean;
  }>>;
  categoryAssignments: Record<string, { 
    categoryId: string | null; 
    categoryName: string | null;
    confidence?: number;
    mappedStages?: any[];
    requiresCustomWorkflow?: boolean;
  }>;
  stats: {
    totalJobs: number;
    jobsCreated: number;
    workflowsInitialized: number;
    errors: string[];
    total: number;
    successful: number;
    failed: number;
  };
  createdJobs?: ParsedJob[];
  failedJobs?: any[];
  newCategories?: any[];
  userApprovedStageMappings?: Array<{
    groupName: string;
    mappedStageId: string;
    mappedStageName: string;
    category: string;
  }>;
}

export class EnhancedJobCreator {
  private logger: ExcelImportDebugger;
  private userId: string;
  private generateQRCodes: boolean;

  constructor(userId: string, logger: ExcelImportDebugger, generateQRCodes: boolean = true) {
    this.userId = userId;
    this.logger = logger;
    this.generateQRCodes = generateQRCodes;
  }

  async prepareEnhancedJobsWithExcelData(
    jobs: ParsedJob[], 
    rowMappings: Record<string, Array<{
      groupName: string;
      mappedStageId: string;
      mappedStageName: string;
      category: string;
      qty?: number;
      isUnmapped?: boolean;
      confidence?: number;
      manualOverride?: boolean;
    }>>, 
    categoryAssignments: Record<string, { categoryId: string | null; categoryName: string | null }>
  ): Promise<EnhancedJobCreationResult> {
    this.logger.addDebugInfo(`🚀 PREPARE ENHANCED JOBS: Processing ${jobs.length} jobs with enhanced mappings`);
    
    const result: EnhancedJobCreationResult = {
      jobs,
      rowMappings,
      categoryAssignments,
      stats: {
        totalJobs: jobs.length,
        jobsCreated: 0,
        workflowsInitialized: 0,
        errors: [],
        total: jobs.length,
        successful: 0,
        failed: 0
      }
    };

    this.logger.addDebugInfo(`✅ Enhanced jobs prepared for review - ready for user confirmation`);
    return result;
  }


  private async createSingleJob(
    originalJob: ParsedJob, 
    finalResult: EnhancedJobCreationResult, 
    userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
  ): Promise<void> {
    const woNo = originalJob.wo_no;
    this.logger.addDebugInfo(`🔧 Creating individual job: ${woNo}`);

    // 1. Build enhanced job data from original job
    const enhancedJobData = await this.buildEnhancedJobData(originalJob);
    this.logger.addDebugInfo(`Enhanced job data prepared for ${woNo}`);

    // 2. Generate QR codes if enabled
    if (this.generateQRCodes) {
      try {
        const { qrCodeData, qrCodeUrl } = await this.generateJobQRCode(originalJob);
        enhancedJobData.qr_code_data = qrCodeData;
        enhancedJobData.qr_code_url = qrCodeUrl;
        this.logger.addDebugInfo(`QR code generated for ${woNo}`);
      } catch (qrError) {
        this.logger.addDebugInfo(`Warning: QR code generation failed for ${woNo}: ${qrError}`);
        // Continue without QR code
      }
    }

    // 3. Insert job into database
    let insertedJob: any;
    try {
      const { data: newJob, error: insertError } = await supabase
        .from('production_jobs')
        .insert([enhancedJobData])
        .select()
        .single();

      if (insertError) {
        throw new Error(`Database insertion failed: ${insertError.message}`);
      }

      if (!newJob) {
        throw new Error('No job data returned from database after insertion');
      } else {
        insertedJob = newJob;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown database error';
      throw new Error(`Job creation failed for ${woNo}: ${errorMsg}`);
    }

    // 4. Auto-create custom workflow from mapped stages
    if (userApprovedMappings && userApprovedMappings.length > 0) {
      await this.initializeUserWorkflow(insertedJob, originalJob, userApprovedMappings);
    } else {
      await this.initializeFuzzyWorkflow(insertedJob, originalJob, finalResult);
    }
    this.logger.addDebugInfo(`Job ${woNo} finalized with custom workflow`);

    // 5. Update QR codes with actual job ID
    if (this.generateQRCodes && insertedJob && insertedJob.qr_code_data) {
      try {
        await this.updateJobQRCode(insertedJob);
      } catch (qrError) {
        this.logger.addDebugInfo(`Warning: QR code update failed for ${woNo}: ${qrError}`);
        // Don't fail the entire job creation for QR code issues
      }
    }

    finalResult.stats.workflowsInitialized++;
  }

  async createEnhancedJobs(jobs: ParsedJob[], result: EnhancedJobCreationResult): Promise<EnhancedJobCreationResult> {
    this.logger.addDebugInfo(`🚀 Creating ${jobs.length} enhanced jobs with custom workflows`);

    for (const job of jobs) {
      try {
        await this.createSingleEnhancedJob(job, result);
        result.stats.jobsCreated++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        this.logger.addDebugInfo(`❌ Job creation failed for ${job.wo_no}: ${errorMsg}`);
        result.stats.errors.push(`${job.wo_no}: ${errorMsg}`);
      }
    }

    this.logger.addDebugInfo(`🏁 Enhanced job creation complete: ${result.stats.jobsCreated}/${jobs.length} jobs created`);
    return result;
  }

  private async createSingleEnhancedJob(job: ParsedJob, result: EnhancedJobCreationResult): Promise<void> {
    this.logger.addDebugInfo(`🔧 Creating enhanced job: ${job.wo_no}`);

    // 1. Build enhanced job data from parsed job
    const enhancedJobData = await this.buildEnhancedJobData(job);
    this.logger.addDebugInfo(`Enhanced job data prepared for ${job.wo_no}`);

    // 2. Generate QR codes if enabled
    if (this.generateQRCodes) {
      try {
        const { qrCodeData, qrCodeUrl } = await this.generateJobQRCode(job);
        enhancedJobData.qr_code_data = qrCodeData;
        enhancedJobData.qr_code_url = qrCodeUrl;
        this.logger.addDebugInfo(`QR code generated for ${job.wo_no}`);
      } catch (qrError) {
        this.logger.addDebugInfo(`Warning: QR code generation failed for ${job.wo_no}: ${qrError}`);
        // Continue without QR code
      }
    }

    // 3. Insert job into database
    let insertedJob: any;
    try {
      const { data: newJob, error: insertError } = await supabase
        .from('production_jobs')
        .insert([enhancedJobData])
        .select()
        .single();

      if (insertError) {
        throw new Error(`Database insertion failed: ${insertError.message}`);
      }

      if (!newJob) {
        throw new Error('No job data returned from database after insertion');
      } else {
        insertedJob = newJob;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown database error';
      throw new Error(`Job creation failed for ${job.wo_no}: ${errorMsg}`);
    }

    // 4. Auto-create custom workflow from mapped stages
    await this.initializeFuzzyWorkflow(insertedJob, job, result);
    this.logger.addDebugInfo(`Job ${job.wo_no} created with custom workflow`);
    result.stats.workflowsInitialized++;

    // 5. Update QR codes with actual job ID
    if (this.generateQRCodes && insertedJob && insertedJob.qr_code_data) {
      try {
        await this.updateJobQRCode(insertedJob);
      } catch (qrError) {
        this.logger.addDebugInfo(`Warning: QR code update failed for ${job.wo_no}: ${qrError}`);
        // Don't fail the entire job creation for QR code issues
      }
    }
  }

  private async buildEnhancedJobData(job: ParsedJob): Promise<any> {
    this.logger.addDebugInfo(`Building enhanced job data for ${job.wo_no} with enhanced specifications`);

    // Generate QR code data for the job
    const qrCodeData = JSON.stringify({
      jobId: 'temp', // Will be updated after job creation
      woNo: job.wo_no,
      type: 'production_job',
      createdAt: new Date().toISOString()
    });

    let qrCodeUrl = '';
    if (this.generateQRCodes) {
      try {
        qrCodeUrl = await QRCode.toDataURL(qrCodeData, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
      } catch (qrError) {
        this.logger.addDebugInfo(`QR code generation failed for ${job.wo_no}: ${qrError}`);
      }
    }

    const enhancedJobData = {
      wo_no: job.wo_no,
      user_id: this.userId,
      // Core job data
      customer: job.customer || null,
      reference: job.reference || null,
      qty: job.qty || null,
      size: job.size || null,
      specification: job.specification || null,
      date: job.date || null,
      due_date: job.due_date || null,
      so_no: null,
      qt_no: null,
      rep: job.rep || null,
      user_name: null,
      location: job.location || null,
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

  private async generateJobQRCode(job: ParsedJob): Promise<{ qrCodeData: string; qrCodeUrl: string }> {
    const qrCodeData = JSON.stringify({
      jobId: 'temp', // Will be updated after job creation
      woNo: job.wo_no,
      type: 'production_job',
      createdAt: new Date().toISOString()
    });

    const qrCodeUrl = await QRCode.toDataURL(qrCodeData, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return { qrCodeData, qrCodeUrl };
  }

  private async calculateDueDateForJob(jobId: string, job: ParsedJob): Promise<void> {
    try {
      this.logger.addDebugInfo(`Calculating due date for ${job.wo_no} based on stage timings`);

      // Get all stage instances for this job
      const { data: stageInstances, error } = await supabase
        .from('job_stage_instances')
        .select('estimated_duration_minutes, setup_time_minutes')
        .eq('job_id', jobId);

      if (error || !stageInstances) {
        this.logger.addDebugInfo(`Failed to get stage instances for due date calculation: ${error?.message}`);
        return;
      }

      // Calculate total time in minutes
      const totalMinutes = stageInstances.reduce((total, stage) => {
        const duration = stage.estimated_duration_minutes || 0;
        const setup = stage.setup_time_minutes || 0;
        return total + duration + setup;
      }, 0);

      // Convert to days (assuming 8-hour workdays)
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
    
    try {
      // Call the Supabase RPC function to initialize custom job stages
      const { data, error } = await supabase.rpc('initialize_custom_job_stages', {
        p_job_id: insertedJob.id,
        p_job_table_name: 'production_jobs',
        p_stage_ids: [
          '00000000-0000-0000-0000-000000000001', // Pre-Press
          '00000000-0000-0000-0000-000000000002', // Printing
          '00000000-0000-0000-0000-000000000003', // Finishing
          '00000000-0000-0000-0000-000000000004', // Delivery
        ],
        p_stage_orders: [1, 2, 3, 4]
      });

      if (error) {
        throw new Error(`Custom workflow initialization failed: ${error.message}`);
      }

      this.logger.addDebugInfo(`Default custom workflow initialized for ${originalJob.wo_no}`);
      
    } catch (error) {
      this.logger.addDebugInfo(`Error initializing default custom workflow: ${error}`);
      throw error;
    }
  }

  private async initializeUserWorkflow(insertedJob: any, originalJob: ParsedJob, userApprovedMappings: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>): Promise<void> {
    this.logger.addDebugInfo(`🎯 USER WORKFLOW: Creating workflow from ${userApprovedMappings.length} user-approved mappings for job ${originalJob.wo_no}`);
    
    userApprovedMappings.forEach((mapping) => {
      this.logger.addDebugInfo(`   - Group "${mapping.groupName}" -> Stage ${mapping.mappedStageId} (${mapping.mappedStageName}) [${mapping.category}]`);
    });
    
    await this.createStageInstancesFromUserMappings(insertedJob, originalJob, userApprovedMappings);
    
    // Mark job as having custom workflow
    await supabase
      .from('production_jobs')
      .update({ has_custom_workflow: true })
      .eq('id', insertedJob.id);
      
    this.logger.addDebugInfo(`✅ USER WORKFLOW COMPLETE: Created ${userApprovedMappings.length} stages from user mappings`);
  }

  private async initializeFuzzyWorkflow(insertedJob: any, originalJob: ParsedJob, result: EnhancedJobCreationResult): Promise<void> {
    this.logger.addDebugInfo(`🤖 FUZZY WORKFLOW: Using system detection for job ${originalJob.wo_no}`);
    
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

    // Create workflow from mappings (simplified fuzzy logic)
    try {
      await this.createWorkflowFromMappings(insertedJob, originalJob, rowMappings, allProductionStages);
      
      // Verify stages were created
      const { data: createdStages } = await supabase
        .from('job_stage_instances')
        .select('id, production_stage_id, status')
        .eq('job_id', insertedJob.id);

      if (!createdStages || createdStages.length === 0) {
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
      this.logger.addDebugInfo(`Fuzzy workflow initialization error for ${originalJob.wo_no}: ${error}`);
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
      // Simple fallback timing calculation
      this.logger.addDebugInfo(`⚠️ Using simple fallback timing calculation`);
      return { estimatedDuration: 60, setupTime: 30 };
      
    } catch (error) {
      this.logger.addDebugInfo(`⚠️ Enhanced timing failed, using local fallback: ${error}`);
      
      // CRITICAL: Enhanced fallback using local production_stages table
      const { data: stageData, error: stageError } = await supabase
        .from('production_stages')
        .select('make_ready_time_minutes, running_speed_per_hour, speed_unit')
        .eq('id', stageId)
        .single();

      if (stageError || !stageData) {
        this.logger.addDebugInfo(`⚠️ Stage data lookup failed, using absolute fallback`);
        return { estimatedDuration: 60, setupTime: 30 }; // 1 hour + 30min setup
      }

      // Calculate using stage base values
      const makeReadyMinutes = stageData.make_ready_time_minutes || 30;
      const runningSpeed = stageData.running_speed_per_hour || 100;
      const speedUnit = stageData.speed_unit || 'units';
      
      let productionMinutes = 0;
      if (speedUnit === 'sheets') {
        productionMinutes = Math.ceil((quantity / runningSpeed) * 60);
      } else {
        productionMinutes = Math.ceil((quantity / runningSpeed) * 60);
      }

      const totalMinutes = makeReadyMinutes + productionMinutes;
      
      this.logger.addDebugInfo(`📊 Local fallback timing: ${totalMinutes}min (${makeReadyMinutes}min setup + ${productionMinutes}min production) for ${quantity} ${speedUnit}`);
      
      return {
        estimatedDuration: totalMinutes,
        setupTime: makeReadyMinutes
      };
    }
  }

  private async createStageInstancesFromUserMappings(
    insertedJob: any, 
    originalJob: ParsedJob, 
    userApprovedMappings: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>
  ): Promise<void> {
    this.logger.addDebugInfo(`🎯 CREATING STAGE INSTANCES FROM USER MAPPINGS for ${originalJob.wo_no}`);
    this.logger.addDebugInfo(`📋 Processing ${userApprovedMappings.length} user-approved stage mappings`);

    const stageInstances = [];
    let stageOrder = 1;

    for (const mapping of userApprovedMappings) {
      this.logger.addDebugInfo(`🔧 Creating stage instance: ${mapping.mappedStageName} (${mapping.mappedStageId})`);
      
      // Find quantity for this mapping
      const quantity = this.findQuantityForMapping(originalJob, mapping);
      this.logger.addDebugInfo(`📊 Quantity for ${mapping.mappedStageName}: ${quantity}`);

      // Calculate timing for this stage
      const { estimatedDuration, setupTime } = await this.calculateStageTimingWithInheritance(
        quantity,
        mapping.mappedStageId
      );

      const stageInstance = {
        job_id: insertedJob.id,
        job_table_name: 'production_jobs',
        production_stage_id: mapping.mappedStageId,
        stage_order: stageOrder++,
        status: 'pending',
        quantity: quantity,
        estimated_duration_minutes: estimatedDuration,
        setup_time_minutes: setupTime,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      stageInstances.push(stageInstance);
      this.logger.addDebugInfo(`✅ Stage instance prepared: ${mapping.mappedStageName} (Order: ${stageInstance.stage_order}, Qty: ${quantity}, Duration: ${estimatedDuration}min)`);
    }

    // Insert all stage instances at once
    const { data: insertedStages, error: insertError } = await supabase
      .from('job_stage_instances')
      .insert(stageInstances)
      .select('id, production_stage_id, stage_order');

    if (insertError) {
      throw new Error(`Failed to create stage instances: ${insertError.message}`);
    }

    this.logger.addDebugInfo(`🎉 SUCCESS: ${insertedStages?.length || 0} stage instances created from user mappings`);
    
    // Log each created stage for verification
    insertedStages?.forEach(stage => {
      this.logger.addDebugInfo(`   ✓ Stage ${stage.production_stage_id} created with order ${stage.stage_order}`);
    });
  }

  private async createWorkflowFromMappings(
    insertedJob: any, 
    originalJob: ParsedJob, 
    rowMappings: Array<{
      groupName: string;
      mappedStageId: string;
      mappedStageName: string;
      category: string;
      qty?: number;
      isUnmapped?: boolean;
    }>, 
    allProductionStages: any[]
  ): Promise<void> {
    this.logger.addDebugInfo(`🔧 Creating workflow from ${rowMappings.length} row mappings for ${originalJob.wo_no}`);

    // Filter out unmapped entries and create unique stage list
    const validMappings = rowMappings.filter(mapping => 
      !mapping.isUnmapped && mapping.mappedStageId
    );

    this.logger.addDebugInfo(`Found ${validMappings.length} valid mappings after filtering`);

    if (validMappings.length === 0) {
      this.logger.addDebugInfo(`No valid mappings found - using default workflow`);
      await this.initializeDefaultCustomWorkflow(insertedJob, originalJob);
      return;
    }

    // Create stage instances from mappings
    const stageInstances = [];
    let stageOrder = 1;

    for (const mapping of validMappings) {
      const quantity = mapping.qty || originalJob.qty || 1;
      
      // Calculate timing for this stage
      const { estimatedDuration, setupTime } = await this.calculateStageTimingWithInheritance(
        quantity,
        mapping.mappedStageId
      );

      const stageInstance = {
        job_id: insertedJob.id,
        job_table_name: 'production_jobs',
        production_stage_id: mapping.mappedStageId,
        stage_order: stageOrder++,
        status: 'pending',
        quantity: quantity,
        estimated_duration_minutes: estimatedDuration,
        setup_time_minutes: setupTime,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      stageInstances.push(stageInstance);
      this.logger.addDebugInfo(`Stage instance prepared: ${mapping.mappedStageName} (Qty: ${quantity})`);
    }

    // Insert all stage instances
    const { data: insertedStages, error: insertError } = await supabase
      .from('job_stage_instances')
      .insert(stageInstances)
      .select('id, production_stage_id');

    if (insertError) {
      throw new Error(`Failed to create workflow stages: ${insertError.message}`);
    }

    this.logger.addDebugInfo(`✅ Created ${insertedStages?.length || 0} stage instances for workflow`);
  }

  private findQuantityForMapping(
    originalJob: ParsedJob, 
    mapping: {groupName: string, mappedStageId: string, mappedStageName: string, category: string}
  ): number {
    // Try to find quantity from the mapping group name or fall back to job quantity
    if (mapping.groupName) {
      // Look for quantity in operation_quantities
      if (originalJob.operation_quantities && typeof originalJob.operation_quantities === 'object') {
        const opQty = originalJob.operation_quantities[mapping.groupName];
        if (typeof opQty === 'number' && opQty > 0) {
          this.logger.addDebugInfo(`Found operation quantity for ${mapping.groupName}: ${opQty}`);
          return opQty;
        }
      }

      // Try parsing quantity from group name (e.g., "Cover (30 qty)")
      const qtyMatch = mapping.groupName.match(/\((\d+)\s*qty\)/i);
      if (qtyMatch) {
        const parsedQty = parseInt(qtyMatch[1], 10);
        this.logger.addDebugInfo(`Parsed quantity from group name "${mapping.groupName}": ${parsedQty}`);
        return parsedQty;
      }
    }

    // Fall back to main job quantity
    if (originalJob.qty && originalJob.qty > 0) {
      this.logger.addDebugInfo(`Using main job quantity: ${originalJob.qty}`);
      return originalJob.qty;
    }

    // Final fallback
    this.logger.addDebugInfo(`Warning: No quantity found for stage instance, defaulting to 1`);
    return 1;
  }

  async finalizeEnhancedJobs(
    preparedResult: any, 
    currentUserId?: string, 
    userApprovedMappings?: Array<{
      groupName: string;
      mappedStageId: string;
      mappedStageName: string;
      category: string;
    }>
  ): Promise<EnhancedJobCreationResult> {
    // For now, just return the prepared result as-is
    // In a full implementation, this would save to database
    this.logger.addDebugInfo('Finalizing enhanced jobs (placeholder implementation)');
    
    const result: EnhancedJobCreationResult = {
      jobs: preparedResult.jobs || [],
      rowMappings: preparedResult.rowMappings || {},
      categoryAssignments: preparedResult.categoryAssignments || {},
      stats: {
        totalJobs: preparedResult.jobs?.length || 0,
        jobsCreated: preparedResult.jobs?.length || 0,
        workflowsInitialized: 0,
        errors: [],
        total: preparedResult.jobs?.length || 0,
        successful: preparedResult.jobs?.length || 0,
        failed: 0
      },
      userApprovedStageMappings: userApprovedMappings
    };

    return result;
  }
}