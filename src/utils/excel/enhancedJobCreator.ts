import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/integrations/supabase/client';
import { ProductionJobData } from '@/types/productionJob';
import { ExcelImportDebugger } from './debugger';
import { TimingCalculationService } from '@/services/timingCalculationService';

interface JobData {
  wo_number: string;
  customer: string;
  reference: string;
  category: string;
  due_date: Date | null;
  stages: StageData[];
  priority: string;
  notes: string;
  quantity: number;
  batchName?: string;
}

interface StageData {
  stage_name: string;
  assigned_user: string;
  estimated_time: number;
  completed: boolean;
  notes: string;
  stage_specification?: string;
}

export class EnhancedJobCreator {
  private debugger: ExcelImportDebugger;

  constructor() {
    this.debugger = new ExcelImportDebugger();
  }

  async processJobData(jobData: JobData): Promise<string | null> {
    this.debugger.clear(); // Clear debug info at the start of each job processing

    try {
      // 1. Fetch or create category
      const categoryId = await this.fetchOrCreateCategory(jobData.category);
      if (!categoryId) {
        this.debugger.addDebugInfo(`❌ Category "${jobData.category}" could not be fetched or created.`);
        return null;
      }

      // 2. Create the production job
      const job = await this.createProductionJob(jobData, categoryId);
      if (!job) {
        this.debugger.addDebugInfo(`❌ Production job "${jobData.wo_number}" could not be created.`);
        return null;
      }

      // 3. Process and create job stages
      await this.processJobStages(job.id, jobData);

      // 4. [Conditional] Create Batch and Batch Job Reference if batchName is provided
      if (jobData.batchName) {
        await this.createBatchAndReference(jobData.batchName, job.id);
      }

      this.debugger.addDebugInfo(`✅ Job "${jobData.wo_number}" processed successfully.`);
      return job.id; // Return the job ID for potential future use
    } catch (error: any) {
      console.error("🔥 Error processing job data:", error);
      this.debugger.addDebugInfo(`🔥 Critical error processing job: ${error.message}`);
      return null;
    }
  }

  private async fetchOrCreateCategory(categoryName: string): Promise<string | null> {
    try {
      // Fetch existing category
      const { data: existingCategory, error: fetchError } = await supabase
        .from('categories')
        .select('id')
        .eq('name', categoryName)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // Ignore "not found" error
        console.error("❌ Error fetching category:", fetchError);
        return null;
      }

      if (existingCategory) {
        this.debugger.addDebugInfo(`✅ Category "${categoryName}" found with ID: ${existingCategory.id}.`);
        return existingCategory.id;
      }

      // Create category if not found
      const { data: newCategory, error: createError } = await supabase
        .from('categories')
        .insert([{ id: uuidv4(), name: categoryName }])
        .select('id')
        .single();

      if (createError) {
        console.error("❌ Error creating category:", createError);
        return null;
      }

      this.debugger.addDebugInfo(`✨ Category "${categoryName}" created with ID: ${newCategory.id}.`);
      return newCategory.id;
    } catch (error: any) {
      console.error("🔥 Error fetching or creating category:", error);
      this.debugger.addDebugInfo(`🔥 Critical error fetching/creating category: ${error.message}`);
      return null;
    }
  }

  private async createProductionJob(jobData: JobData, categoryId: string): Promise<{ id: string } | null> {
    try {
      const newJobId = uuidv4();

      const { data: job, error: jobError } = await supabase
        .from('production_jobs')
        .insert([
          {
            id: newJobId,
            wo_no: jobData.wo_number,
            customer: jobData.customer,
            reference: jobData.reference,
            category_id: categoryId,
            due_date: jobData.due_date,
            priority: jobData.priority,
            notes: jobData.notes,
            qty: jobData.quantity,
            status: 'pending' // Default status for new jobs
          }
        ])
        .select('id')
        .single();

      if (jobError) {
        console.error("❌ Error creating production job:", jobError);
        return null;
      }

      this.debugger.addDebugInfo(`🔨 Job "${jobData.wo_number}" created with ID: ${job.id}.`);
      return job;
    } catch (error: any) {
      console.error("🔥 Error creating production job:", error);
      this.debugger.addDebugInfo(`🔥 Critical error creating job: ${error.message}`);
      return null;
    }
  }

  private async processJobStages(jobId: string, jobData: JobData): Promise<void> {
    for (const stageData of jobData.stages) {
      try {
        // 1. Fetch production stage
        const { data: productionStage, error: stageError } = await supabase
          .from('production_stages')
          .select('id, running_speed_per_hour, make_ready_time_minutes, speed_unit, ignore_excel_quantity')
          .ilike('name', stageData.stage_name)
          .eq('is_active', true)
          .single();

        if (stageError) {
          console.warn(`⚠️  Production stage "${stageData.stage_name}" not found: ${stageError.message}`);
          this.debugger.addDebugInfo(`⚠️  Production stage "${stageData.stage_name}" not found.`);
          continue; // Skip to the next stage
        }

        // 2. Fetch or create user
        const assignedUserId = await this.fetchOrCreateUser(stageData.assigned_user);
        if (!assignedUserId) {
          console.warn(`⚠️  User "${stageData.assigned_user}" not found or created.`);
          this.debugger.addDebugInfo(`⚠️  User "${stageData.assigned_user}" not found or created.`);
          continue; // Skip to the next stage
        }

        // 3. Fetch stage specification (if provided)
        let stageSpecificationId: string | null = null;
        if (stageData.stage_specification) {
          const { data: stageSpec, error: specError } = await supabase
            .from('stage_specifications')
            .select('id')
            .ilike('name', stageData.stage_specification)
            .eq('production_stage_id', productionStage.id)
            .eq('is_active', true)
            .single();

          if (specError) {
            console.warn(`⚠️  Stage specification "${stageData.stage_specification}" not found: ${specError.message}`);
            this.debugger.addDebugInfo(`⚠️  Stage specification "${stageData.stage_specification}" not found.`);
          } else if (stageSpec) {
            stageSpecificationId = stageSpec.id;
            this.debugger.addDebugInfo(`✅ Stage specification "${stageData.stage_specification}" found with ID: ${stageSpec.id}.`);
          }
        }

        // 4. Calculate timing using the new service
        const timingParams = {
          quantity: jobData.quantity,
          stageId: productionStage.id,
          specificationId: stageSpecificationId || undefined,
          stageData: productionStage,
        };

        const timingEstimate = await TimingCalculationService.calculateStageTimingWithInheritance(timingParams);

        // 5. Create job stage instance
        const newStageInstanceId = uuidv4();
        const { error: instanceError } = await supabase
          .from('job_stage_instances')
          .insert([
            {
              id: newStageInstanceId,
              job_id: jobId,
              job_table_name: 'production_jobs',
              production_stage_id: productionStage.id,
              stage_specification_id: stageSpecificationId,
              assigned_user_id: assignedUserId,
              stage_order: 1, // Default order
              status: 'pending', // Default status
              estimated_duration_minutes: timingEstimate.estimatedDurationMinutes,
              quantity: jobData.quantity,
              notes: stageData.notes,
              unique_stage_key: `${jobId}-${productionStage.id}-${stageSpecificationId || 'none'}`
            }
          ]);

        if (instanceError) {
          console.error("❌ Error creating job stage instance:", instanceError);
          this.debugger.addDebugInfo(`❌ Error creating job stage instance for "${stageData.stage_name}": ${instanceError.message}`);
        } else {
          this.debugger.addDebugInfo(`✅ Stage "${stageData.stage_name}" created for job ${jobId}.`);
        }
      } catch (error: any) {
        console.error("🔥 Error processing stage:", error);
        this.debugger.addDebugInfo(`🔥 Critical error processing stage "${stageData.stage_name}": ${error.message}`);
      }
    }
  }

  private async fetchOrCreateUser(username: string): Promise<string | null> {
    try {
      // Fetch existing user
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // Ignore "not found" error
        console.error("❌ Error fetching user:", fetchError);
        return null;
      }

      if (existingUser) {
        this.debugger.addDebugInfo(`✅ User "${username}" found with ID: ${existingUser.id}.`);
        return existingUser.id;
      }

      // Create user if not found
      const newUserId = uuidv4();
      const { error: createError } = await supabase
        .from('users')
        .insert([{ id: newUserId, username: username }])
        .select('id')
        .single();

      if (createError) {
        console.error("❌ Error creating user:", createError);
        return null;
      }

      this.debugger.addDebugInfo(`✨ User "${username}" created with ID: ${newUserId}.`);
      return newUserId;
    } catch (error: any) {
      console.error("🔥 Error fetching or creating user:", error);
      this.debugger.addDebugInfo(`🔥 Critical error fetching/creating user: ${error.message}`);
      return null;
    }
  }

  private async createBatchAndReference(batchName: string, jobId: string): Promise<void> {
    try {
      // 1. Fetch or create batch
      let batchId: string | null = null;
      const { data: existingBatch, error: fetchBatchError } = await supabase
        .from('batches')
        .select('id')
        .eq('name', batchName)
        .single();

      if (fetchBatchError && fetchBatchError.code !== 'PGRST116') {
        console.error("❌ Error fetching batch:", fetchBatchError);
        this.debugger.addDebugInfo(`❌ Error fetching batch "${batchName}": ${fetchBatchError.message}`);
        return;
      }

      if (existingBatch) {
        batchId = existingBatch.id;
        this.debugger.addDebugInfo(`✅ Batch "${batchName}" found with ID: ${batchId}.`);
      } else {
        const newBatchId = uuidv4();
        const { error: createBatchError } = await supabase
          .from('batches')
          .insert([{ id: newBatchId, name: batchName, status: 'pending' }])
          .select('id')
          .single();

        if (createBatchError) {
          console.error("❌ Error creating batch:", createBatchError);
          this.debugger.addDebugInfo(`❌ Error creating batch "${batchName}": ${createBatchError.message}`);
          return;
        }

        batchId = newBatchId;
        this.debugger.addDebugInfo(`✨ Batch "${batchName}" created with ID: ${batchId}.`);
      }

      // 2. Create batch job reference
      const { error: refError } = await supabase
        .from('batch_job_references')
        .insert([{ batch_id: batchId, production_job_id: jobId }]);

      if (refError) {
        console.error("❌ Error creating batch job reference:", refError);
        this.debugger.addDebugInfo(`❌ Error creating batch job reference for job ${jobId} in batch "${batchName}": ${refError.message}`);
      } else {
        this.debugger.addDebugInfo(`✅ Batch job reference created for job ${jobId} in batch "${batchName}".`);
      }
    } catch (error: any) {
      console.error("🔥 Error creating batch or reference:", error);
      this.debugger.addDebugInfo(`🔥 Critical error creating batch/reference: ${error.message}`);
    }
  }

  // Method to fetch debug information
  getDebugInfo(): string[] {
    return this.debugger.getDebugInfo();
  }
}
