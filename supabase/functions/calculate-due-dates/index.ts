import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

interface CalculateDueDatesRequest {
  action: 'calculate_due_dates' | 'recalculate_all' | 'recalculate_single';
  job_id?: string;
  trigger_reason?: string;
}

interface JobWithStages {
  id: string;
  wo_no: string;
  customer: string;
  proof_approved_at: string;
  production_ready: boolean;
  stages: Array<{
    id: string;
    production_stage_id: string;
    stage_name: string;
    stage_order: number;
    estimated_duration_minutes: number;
    status: string;
  }>;
}

interface StageWorkload {
  production_stage_id: string;
  stage_name: string;
  pending_hours: number;
  active_hours: number;
  queue_processing_days: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}


Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { action, job_id, trigger_reason } = await req.json() as CalculateDueDatesRequest;

    
    console.log(`[calculate-due-dates] Action: ${action}, Job ID: ${job_id || 'all'}`);

    // Create calculation log entry
    const calc_run_id = crypto.randomUUID();
    await supabase.from('schedule_calculation_log').insert({
      calculation_run_id: calc_run_id,
      calculation_type: 'due_date_calculation',
      trigger_reason: trigger_reason || `Due date calculation triggered via ${action}`,
      started_at: new Date().toISOString()
    });

    // Step 1: Get all production-ready jobs sorted by proof approval time (FIFO queue)
    const { data: productionJobs, error: jobsError } = await supabase
      .from('production_jobs')
      .select(`
        id, wo_no, customer, proof_approved_at, production_ready,
        job_stage_instances!inner(
          id, production_stage_id, stage_order, estimated_duration_minutes, status,
          production_stages!inner(name)
        )
      `)
      .eq('production_ready', true)
      .not('proof_approved_at', 'is', null)
      .order('proof_approved_at', { ascending: true });

    if (jobsError) {
      throw new Error(`Failed to fetch production jobs: ${jobsError.message}`);
    }

    console.log(`[calculate-due-dates] Found ${productionJobs?.length || 0} production-ready jobs`);

    // Step 2: Get current stage workloads for all production stages
    const { data: stageWorkloads, error: workloadError } = await supabase
      .rpc('calculate_stage_queue_workload');

    if (workloadError) {
      throw new Error(`Failed to calculate stage workloads: ${workloadError.message}`);
    }

    // Create workload lookup map
    const workloadMap = new Map<string, StageWorkload>();
    stageWorkloads?.forEach((workload: StageWorkload) => {
      workloadMap.set(workload.production_stage_id, workload);
    });

    // Step 3: Process each job and calculate its position in each stage queue
    let processedJobs = 0;
    const jobUpdates: Array<{
      id: string;
      queue_calculated_due_date: string;
      last_queue_recalc_at: string;
    }> = [];

    for (const job of productionJobs || []) {
      try {
        // Transform job data
        const jobWithStages: JobWithStages = {
          id: job.id,
          wo_no: job.wo_no,
          customer: job.customer,
          proof_approved_at: job.proof_approved_at,
          production_ready: job.production_ready,
          stages: (job.job_stage_instances as any[]).map(stage => ({
            id: stage.id,
            production_stage_id: stage.production_stage_id,
            stage_name: stage.production_stages.name,
            stage_order: stage.stage_order,
            estimated_duration_minutes: stage.estimated_duration_minutes || 120,
            status: stage.status
          }))
        };

        // Calculate total processing time for this job
        let totalProcessingDays = 0;
        const jobApprovalDate = new Date(job.proof_approved_at);

        // For each stage, calculate queue position and processing time
        for (const stage of jobWithStages.stages) {
          if (stage.status === 'pending' || stage.status === 'active') {
            const workload = workloadMap.get(stage.production_stage_id);
            if (workload) {
              // Add this stage's queue processing time
              const stageHours = stage.estimated_duration_minutes / 60;
              totalProcessingDays += (workload.queue_processing_days + (stageHours / 8)); // 8 hours per day
            }
          }
        }

        // Calculate due date: start from proof approval + processing time + 1 buffer day
        const calculatedDueDate = new Date(jobApprovalDate);
        calculatedDueDate.setDate(calculatedDueDate.getDate() + Math.ceil(totalProcessingDays) + 1);

        // Skip weekends (move to next Monday if it falls on weekend)
        while (calculatedDueDate.getDay() === 0 || calculatedDueDate.getDay() === 6) {
          calculatedDueDate.setDate(calculatedDueDate.getDate() + 1);
        }

        jobUpdates.push({
          id: job.id,
          queue_calculated_due_date: calculatedDueDate.toISOString().split('T')[0],
          last_queue_recalc_at: new Date().toISOString()
        });

        processedJobs++;
        console.log(`[calculate-due-dates] Job ${job.wo_no}: Due ${calculatedDueDate.toISOString().split('T')[0]} (${Math.ceil(totalProcessingDays)} processing days)`);

      } catch (jobError) {
        console.error(`[calculate-due-dates] Error processing job ${job.id}:`, jobError);
      }
    }

    // Step 4: Batch update all jobs with new due dates
    if (jobUpdates.length > 0) {
      for (const update of jobUpdates) {
        await supabase
          .from('production_jobs')
          .update({
            queue_calculated_due_date: update.queue_calculated_due_date,
            last_queue_recalc_at: update.last_queue_recalc_at,
            updated_at: new Date().toISOString()
          })
          .eq('id', update.id);
      }
    }

    // Update calculation log
    await supabase
      .from('schedule_calculation_log')
      .update({
        completed_at: new Date().toISOString(),
        jobs_processed: processedJobs,
        execution_time_ms: Date.now() - new Date().getTime()
      })
      .eq('calculation_run_id', calc_run_id);

    console.log(`[calculate-due-dates] Completed: ${processedJobs} jobs processed`);

    return new Response(JSON.stringify({
      success: true,
      jobs_processed: processedJobs,
      calculation_run_id: calc_run_id,
      message: `Successfully calculated due dates for ${processedJobs} production-ready jobs`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[calculate-due-dates] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});