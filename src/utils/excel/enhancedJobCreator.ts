import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../types/supabase';

interface JobData {
  id: string;
  wo_number: string;
  customer_id: string;
  customer_name: string;
  reference: string;
  category: string;
  status: string;
  due_date: string | null;
  location: string;
  notes: string | null;
  order_date: string | null;
  rep: string;
  quantity: number;
  paper_specifications: any;
  delivery_specifications: any;
  finishing_specifications: any;
  prepress_specifications: any;
  printing_specifications: any;
  packaging_specifications: any;
  size: string | null;
  contact: string | null;
  specification: string | null;
  estimated_hours: number | null;
  setup_time_minutes: number | null;
  running_speed: number | null;
  speed_unit: string | null;
}

interface StageInstance {
  id: string;
  production_stage_id: string;
  stage_specification_id: string | null;
  quantity: number | null;
  part_name: string | null;
}

interface Stage {
  id: string;
  name: string;
  category: string;
  description: string | null;
  default_labor_cost: number | null;
  default_hourly_rate: number | null;
  default_machine_cost: number | null;
  default_setup_time: number | null;
  default_running_speed: number | null;
  default_speed_unit: string | null;
}

interface StageSpecification {
  id: string;
  name: string;
  description: string | null;
  stage_id: string;
  labor_cost: number | null;
  hourly_rate: number | null;
  machine_cost: number | null;
  setup_time: number | null;
  running_speed: number | null;
  speed_unit: string | null;
}

interface TimingData {
  stage_instance_id: string;
  estimated_time: number | null;
  estimated_cost: number | null;
  start_time: string | null;
  end_time: string | null;
}

interface Operation {
  id: string;
  job_id: string;
  job_table_name: string;
  stage_instance_id: string;
  stage_id: string;
  stage_specification_id: string | null;
  name: string;
  description: string | null;
  part_name: string | null;
  estimated_time: number | null;
  estimated_cost: number | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  notes: string | null;
  labor_cost: number | null;
  hourly_rate: number | null;
  machine_cost: number | null;
  setup_time: number | null;
  running_speed: number | null;
  speed_unit: string | null;
  quantity: number | null;
  completed_time: number | null;
  rejections: number | null;
  rejection_reason: string | null;
  priority: number | null;
  dependencies: string[] | null;
  dependents: string[] | null;
  is_critical: boolean | null;
  is_approved: boolean | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export class EnhancedJobCreator {
  private supabase: SupabaseClient<Database>;
  private readonly defaultHourlyRate: number = 60;
  private readonly defaultMachineCost: number = 30;

  constructor(supabaseClient: SupabaseClient<Database>) {
    this.supabase = supabaseClient;
  }

  async createEnhancedJob(jobData: JobData, tableType: 'production_jobs' | 'archived_jobs'): Promise<any> {
    try {
      console.log(`Starting enhanced job creation for WO: ${jobData.wo_number}`);

      // 1. Create the Job
      const { data: createdJob, error: jobError } = await this.supabase
        .from(tableType)
        .insert([
          {
            wo_number: jobData.wo_number,
            customer_id: jobData.customer_id,
            customer_name: jobData.customer_name,
            reference: jobData.reference,
            category: jobData.category,
            status: jobData.status,
            due_date: jobData.due_date,
            location: jobData.location,
            notes: jobData.notes,
            order_date: jobData.order_date,
            rep: jobData.rep,
            quantity: jobData.quantity,
            paper_specifications: jobData.paper_specifications,
            delivery_specifications: jobData.delivery_specifications,
            finishing_specifications: jobData.finishing_specifications,
            prepress_specifications: jobData.prepress_specifications,
            printing_specifications: jobData.printing_specifications,
            packaging_specifications: jobData.packaging_specifications,
            size: jobData.size,
            contact: jobData.contact,
            specification: jobData.specification,
            estimated_hours: jobData.estimated_hours,
            setup_time_minutes: jobData.setup_time_minutes,
            running_speed: jobData.running_speed,
            speed_unit: jobData.speed_unit,
          },
        ])
        .select()

      if (jobError) {
        console.error('Error creating job:', jobError);
        throw new Error(`Failed to create job: ${jobError.message}`);
      }

      const jobId = createdJob[0].id;
      console.log(`Job created with ID: ${jobId}`);

      // 2. Fetch Stage Instances
      const { data: stageInstances, error: stageInstancesError } = await this.supabase
        .from('job_stage_instances')
        .select('*')
        .eq('job_id', jobId)
        .eq('job_table_name', tableType);

      if (stageInstancesError) {
        console.error('Error fetching stage instances:', stageInstancesError);
        throw new Error(`Failed to fetch stage instances: ${stageInstancesError.message}`);
      }

      if (!stageInstances || stageInstances.length === 0) {
        console.warn(`No stage instances found for job ID: ${jobId}`);
        return { jobId, message: 'No stage instances found for this job.' };
      }

      console.log(`Found ${stageInstances.length} stage instances for job ID: ${jobId}`);

      // 3. Calculate Timing for Job
      await this.calculateTimingForJob(jobId, tableType);

      return { jobId, message: 'Enhanced job creation completed successfully.' };

    } catch (error: any) {
      console.error('Error in createEnhancedJob:', error);
      throw new Error(`Failed to create enhanced job: ${error.message}`);
    }
  }

  private async calculateTimingForJob(jobId: string, tableType: 'production_jobs'): Promise<void> {
    try {
      console.log(`Calculating timing for job ${jobId}`);

      // Initialize Supabase client
      const supabase = this.supabase;

      // Fetch the job to get relevant details
      const { data: jobData, error: jobError } = await supabase
        .from(tableType)
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError) {
        console.error('Error fetching job details:', jobError);
        throw new Error(`Failed to fetch job details: ${jobError.message}`);
      }

      if (!jobData) {
        console.warn(`Job with ID ${jobId} not found.`);
        return;
      }

      const jobQuantity = jobData.quantity || 1; // Default to 1 if quantity is null

      // Get all stage instances for this job with quantities
      const { data: stageInstances, error: stageError } = await supabase
        .from('job_stage_instances')
        .select('id, production_stage_id, stage_specification_id, quantity, part_name, unique_stage_key')
        .eq('job_id', jobId)
        .eq('job_table_name', tableType);

      if (stageError) {
        console.error('Error fetching stage instances:', stageError);
        throw new Error(`Failed to fetch stage instances: ${stageError.message}`);
      }

      // Create a map of stage instance ID to quantity
      const quantityMap = new Map<string, number>();
      let defaultQty = jobQuantity;

      if (stageInstances && stageInstances.length > 0) {
        stageInstances.forEach(instance => {
          if (instance.quantity !== null) {
            quantityMap.set(instance.unique_stage_key || instance.production_stage_id, instance.quantity);
          }
        });

        // If there are stage instances with specific quantities, do not use the job quantity as default
        defaultQty = 0;
      }

      // Calculate timing for each stage instance
      for (const stageInstance of stageInstances) {
        const quantity = quantityMap.get(stageInstance.unique_stage_key || stageInstance.production_stage_id) || defaultQty;

        // Fetch stage and stage specification details
        const { data: stageData, error: stageError } = await supabase
          .from('production_stages')
          .select('*')
          .eq('id', stageInstance.production_stage_id)
          .single();

        if (stageError) {
          console.error('Error fetching stage details:', stageError);
          continue;
        }

        const { data: stageSpecData, error: stageSpecError } = await supabase
          .from('stage_specifications')
          .select('*')
          .eq('id', stageInstance.stage_specification_id)
          .single();

        if (stageSpecError) {
          console.error('Error fetching stage specification details:', stageSpecError);
          continue;
        }

        // Use stage specification values if available, otherwise use stage values
        const hourlyRate = stageSpecData?.hourly_rate ?? stageData?.default_hourly_rate ?? this.defaultHourlyRate;
        const machineCost = stageSpecData?.machine_cost ?? stageData?.default_machine_cost ?? this.defaultMachineCost;
        const setupTime = stageSpecData?.setup_time ?? stageData?.default_setup_time ?? 0;
        const runningSpeed = stageSpecData?.running_speed ?? stageData?.default_running_speed ?? 1;
        const speedUnit = stageSpecData?.speed_unit ?? stageData?.default_speed_unit ?? 'units/hour';
        const laborCost = stageSpecData?.labor_cost ?? stageData?.default_labor_cost ?? hourlyRate;

        // Calculate duration based on speed unit
        let duration: number;
        if (speedUnit === 'units/hour') {
          duration = quantity / runningSpeed;
        } else if (speedUnit === 'units/minute') {
          duration = quantity / (runningSpeed / 60);
        } else if (speedUnit === 'units/second') {
          duration = quantity / (runningSpeed / 3600);
        } else {
          console.warn(`Unknown speed unit: ${speedUnit}. Defaulting to hourly.`);
          duration = quantity / runningSpeed;
        }

        // Add setup time to the duration
        duration += setupTime / 60; // Convert setup time from minutes to hours

        // Calculate estimated cost
        const estimatedCost = (duration * hourlyRate) + machineCost;

        // Update the operation with calculated timing
        const { error: updateError } = await supabase
          .from('job_stage_instances')
          .update({
            estimated_time: duration,
            estimated_cost: estimatedCost,
          })
          .eq('id', stageInstance.id);

        if (updateError) {
          console.error('Error updating operation timing:', updateError);
        } else {
          console.log(`Timing calculated and updated for stage instance ID: ${stageInstance.id}`);
        }
      }

      console.log(`Timing calculation completed for job ${jobId}`);
    } catch (error) {
      console.error('Error in calculateTimingForJob:', error);
    }
  }
}
