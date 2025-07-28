import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface JobProcessingRequest {
  jobIds: string[];
  tableName?: string;
  priority?: 'low' | 'normal' | 'high';
  includeWorkflowInitialization?: boolean;
  includeTimingCalculation?: boolean;
  includeQRCodeGeneration?: boolean;
  userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>;
}

interface JobTimelineStage {
  stageId: string;
  stageName: string;
  estimatedStartDate: Date;
  estimatedCompletionDate: Date;
  estimatedDuration: number;
  queuePosition: number;
}

interface JobTimeline {
  jobId: string;
  stages: JobTimelineStage[];
  totalEstimatedWorkingDays: number;
  bottleneckStage: string | null;
  criticalPath: string[];
}

// Simplified working days calculation for edge function
function addWorkingDays(startDate: Date, daysToAdd: number): Date {
  const result = new Date(startDate);
  let addedDays = 0;
  
  while (addedDays < daysToAdd) {
    result.setDate(result.getDate() + 1);
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (result.getDay() !== 0 && result.getDay() !== 6) {
      addedDays++;
    }
  }
  
  return result;
}

function calculateWorkingDaysBetween(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    if (current.getDay() !== 0 && current.getDay() !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

// Batch function to get stage workloads for multiple stages
async function getStageWorkloadsBatch(supabase: any, stageIds: string[]) {
  const workloads = new Map();
  
  // Get capacity profiles first
  const { data: capacities, error: capacityError } = await supabase
    .from('stage_capacity_profiles')
    .select(`
      production_stage_id,
      daily_capacity_hours,
      efficiency_factor,
      production_stages!inner(name, is_active)
    `)
    .in('production_stage_id', stageIds)
    .eq('production_stages.is_active', true);

  if (capacityError) {
    console.error('Error fetching stage capacities:', capacityError);
    return workloads;
  }

  // Get workload for each stage using the batch function
  const { data: workloadData, error: workloadError } = await supabase
    .rpc('calculate_stage_queue_workload', { stage_ids: stageIds });

  if (workloadError) {
    console.error('Error fetching workload data:', workloadError);
    return workloads;
  }

  // Process the batch results
  for (const workload of workloadData || []) {
    const capacity = capacities?.find(c => c.production_stage_id === workload.stage_id);
    if (capacity) {
      const dailyCapacity = capacity.daily_capacity_hours * (capacity.efficiency_factor || 0.85);
      const queueDaysToProcess = workload.total_pending_hours / dailyCapacity;

      workloads.set(workload.stage_id, {
        stageId: workload.stage_id,
        stageName: capacity.production_stages.name,
        totalPendingHours: parseFloat(workload.total_pending_hours || '0'),
        totalActiveHours: parseFloat(workload.total_active_hours || '0'),
        pendingJobsCount: workload.pending_jobs_count || 0,
        activeJobsCount: workload.active_jobs_count || 0,
        dailyCapacityHours: dailyCapacity,
        earliestAvailableSlot: new Date(workload.earliest_available_slot),
        queueDaysToProcess: Math.ceil(queueDaysToProcess)
      });
    }
  }
  
  return workloads;
}

// Enhanced job timeline calculation using proper workload data
async function calculateJobTimelineBatch(supabase: any, jobIds: string[], tableName: string): Promise<JobTimeline[]> {
  // Get all stage instances for these jobs in one query
  const { data: stageInstances, error: stageError } = await supabase
    .from('job_stage_instances')
    .select(`
      job_id,
      production_stage_id,
      stage_order,
      estimated_duration_minutes,
      status,
      production_stages!inner(name, color)
    `)
    .in('job_id', jobIds)
    .eq('job_table_name', tableName)
    .order('stage_order');

  if (stageError) {
    console.error('Error fetching stage instances:', stageError);
    return [];
  }

  // Get unique stage IDs and fetch their workloads in batch
  const stageIds = [...new Set(stageInstances?.map(si => si.production_stage_id) || [])];
  const stageWorkloads = await getStageWorkloadsBatch(supabase, stageIds);
  
  // Retrieved workload data for ${stageWorkloads.size} stages

  // Build timelines for each job
  const timelines: JobTimeline[] = [];
  
  for (const jobId of jobIds) {
    const jobStages = stageInstances?.filter(si => si.job_id === jobId) || [];
    const stages: JobTimelineStage[] = [];
    let currentDate = new Date();
    let bottleneckStage: string | null = null;
    let maxQueueDays = 0;
    
    for (const stage of jobStages) {
      // Skip completed stages
      if (stage.status === 'completed') {
        continue;
      }
      
      const workload = stageWorkloads.get(stage.production_stage_id);
      const estimatedDurationMinutes = stage.estimated_duration_minutes || 60;
      const estimatedDurationHours = estimatedDurationMinutes / 60;
      
      let estimatedStartDate: Date;
      let estimatedCompletionDate: Date;
      let queuePosition = 0;
      
      if (workload) {
        // Calculate realistic start time based on current workload
        const queueHours = workload.totalPendingHours + workload.totalActiveHours;
        const queueDays = Math.ceil(queueHours / workload.dailyCapacityHours);
        
        // Stage starts after both previous stage completes AND queue allows
        const queueStartDate = addWorkingDays(new Date(), queueDays);
        estimatedStartDate = new Date(Math.max(currentDate.getTime(), queueStartDate.getTime()));
        
        // Stage completes after its duration
        const stageDurationDays = Math.ceil(estimatedDurationHours / workload.dailyCapacityHours);
        estimatedCompletionDate = addWorkingDays(estimatedStartDate, Math.max(1, stageDurationDays));
        
        queuePosition = workload.pendingJobsCount + 1;
        
        // Track bottleneck stage
        if (workload.queueDaysToProcess > maxQueueDays) {
          maxQueueDays = workload.queueDaysToProcess;
          bottleneckStage = stage.production_stage_id;
        }
      } else {
        // Fallback if no workload data available
        estimatedStartDate = currentDate;
        const fallbackDurationDays = Math.ceil(estimatedDurationHours / 8); // 8-hour workday
        estimatedCompletionDate = addWorkingDays(estimatedStartDate, Math.max(1, fallbackDurationDays));
      }
      
      stages.push({
        stageId: stage.production_stage_id,
        stageName: stage.production_stages?.name || 'Unknown',
        estimatedStartDate,
        estimatedCompletionDate,
        estimatedDuration: estimatedDurationMinutes,
        queuePosition
      });
      
      // Next stage can't start until this one completes
      currentDate = estimatedCompletionDate;
    }
    
    const totalWorkingDays = stages.length > 0 
      ? calculateWorkingDaysBetween(new Date(), stages[stages.length - 1].estimatedCompletionDate)
      : 0;
    
    timelines.push({
      jobId,
      stages,
      totalEstimatedWorkingDays: totalWorkingDays,
      bottleneckStage,
      criticalPath: stages.filter(s => s.stageId === bottleneckStage).map(s => s.stageName)
    });
  }
  
  return timelines;
}

async function processJobBatch(
  supabase: any, 
  jobIds: string[], 
  tableName: string,
  options: {
    includeWorkflowInitialization?: boolean;
    includeTimingCalculation?: boolean;
    includeQRCodeGeneration?: boolean;
    userApprovedMappings?: Array<{groupName: string, mappedStageId: string, mappedStageName: string, category: string}>;
  } = {}
) {
  const results = {
    success: true,
    errors: [],
    processed: 0,
    workflowsInitialized: 0,
    timingsCalculated: 0,
    qrCodesGenerated: 0,
    dueDatesCalculated: 0
  };
  
  try {
    // OPTIMIZED: Bulk operations instead of individual processing
    if (options.includeWorkflowInitialization) {
      const { data: jobs } = await supabase
        .from(tableName)
        .select('id, category_id, wo_no')
        .in('id', jobIds)
        .not('category_id', 'is', null);
        
      if (jobs && jobs.length > 0) {
        for (const job of jobs) {
          const { error: workflowError } = await supabase.rpc('initialize_job_stages_auto', {
            p_job_id: job.id,
            p_job_table_name: tableName,
            p_category_id: job.category_id
          });
          
          if (!workflowError) {
            results.workflowsInitialized++;
          } else {
            results.errors.push(`Workflow init failed for ${job.wo_no}: ${workflowError.message}`);
          }
        }
      }
    }
    
    // Process QR codes in bulk
    if (options.includeQRCodeGeneration) {
      const { data: jobs } = await supabase
        .from(tableName)
        .select('id, wo_no, customer, due_date')
        .in('id', jobIds);
        
      if (jobs && jobs.length > 0) {
        const qrUpdates = jobs.map(job => ({
          id: job.id,
          qr_code_data: JSON.stringify({
            job_id: job.id,
            wo_no: job.wo_no,
            customer: job.customer,
            due_date: job.due_date
          }),
          updated_at: new Date().toISOString()
        }));
        
        await supabase
          .from(tableName)
          .upsert(qrUpdates, { onConflict: 'id' });
          
        results.qrCodesGenerated = qrUpdates.length;
      }
    }
    
    results.processed = jobIds.length;
    
    // Calculate due dates for all jobs (batch operation)
    try {
      const timelines = await calculateJobTimelineBatch(supabase, jobIds, tableName);
      
      if (timelines.length > 0) {
        const updates = timelines.map(timeline => {
          const lastStage = timeline.stages[timeline.stages.length - 1];
          const internalCompletionDate = lastStage?.estimatedCompletionDate || new Date();
          const dueDateWithBuffer = addWorkingDays(internalCompletionDate, 1);
          
          return {
            id: timeline.jobId,
            internal_completion_date: internalCompletionDate.toISOString().split('T')[0],
            due_date: dueDateWithBuffer.toISOString().split('T')[0],
            due_date_buffer_days: 1,
            due_date_warning_level: 'green',
            last_due_date_check: new Date().toISOString()
          };
        });
        
        const { error: updateError } = await supabase
          .from(tableName)
          .upsert(updates, { onConflict: 'id' });
        
        if (!updateError) {
          results.dueDatesCalculated = timelines.length;
        } else {
          results.errors.push(`Due date update error: ${updateError.message}`);
        }
      }
    } catch (dueDateError) {
      console.error(`❌ Due date calculation failed:`, dueDateError);
      results.errors.push(`Due date calculation: ${dueDateError instanceof Error ? dueDateError.message : String(dueDateError)}`);
    }
    
    return results;
    
  } catch (error) {
    console.error('Error processing job batch:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      processed: 0,
      workflowsInitialized: 0,
      timingsCalculated: 0,
      qrCodesGenerated: 0,
      dueDatesCalculated: 0,
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { 
      jobIds, 
      tableName = 'production_jobs', 
      priority = 'normal',
      includeWorkflowInitialization = false,
      includeTimingCalculation = false,
      includeQRCodeGeneration = false,
      userApprovedMappings = []
    }: JobProcessingRequest = await req.json();

    if (!jobIds || jobIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'jobIds array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🎯 Processing ${jobIds.length} jobs with workload-based scheduling`);
    
    // Optimize batch size for faster processing
    const batchSize = 25; // Smaller batches for faster response
    const results = [];
    
    for (let i = 0; i < jobIds.length; i += batchSize) {
      const batch = jobIds.slice(i, i + batchSize);
      
      const result = await processJobBatch(supabase, batch, tableName, {
        includeWorkflowInitialization,
        includeTimingCalculation,
        includeQRCodeGeneration,
        userApprovedMappings
      });
      results.push(result);
      
      // No delay for single jobs or small batches
      if (i + batchSize < jobIds.length && jobIds.length > 10) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    // Aggregate results
    const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
    const totalWorkflowsInitialized = results.reduce((sum, r) => sum + (r.workflowsInitialized || 0), 0);
    const totalTimingsCalculated = results.reduce((sum, r) => sum + (r.timingsCalculated || 0), 0);
    const totalQRCodesGenerated = results.reduce((sum, r) => sum + (r.qrCodesGenerated || 0), 0);
    const totalDueDatesCalculated = results.reduce((sum, r) => sum + (r.dueDatesCalculated || 0), 0);
    const allErrors = results.flatMap(r => r.errors || []);
    
    console.log(`✅ Job processing completed: ${totalProcessed}/${jobIds.length} jobs processed`);
    console.log(`📊 Workflows: ${totalWorkflowsInitialized}, Timing: ${totalTimingsCalculated}, QR: ${totalQRCodesGenerated}, Due dates: ${totalDueDatesCalculated}`);
    
    if (allErrors.length > 0) {
      console.log(`⚠️ Errors encountered: ${allErrors.length}`);
      allErrors.forEach(error => console.log(`   - ${error}`));
    }
    
    return new Response(
      JSON.stringify({
        success: totalProcessed > 0,
        processed: totalProcessed,
        total: jobIds.length,
        workflowsInitialized: totalWorkflowsInitialized,
        timingsCalculated: totalTimingsCalculated,
        qrCodesGenerated: totalQRCodesGenerated,
        dueDatesCalculated: totalDueDatesCalculated,
        errors: allErrors,
        priority,
        tableName,
        message: `Processed ${totalProcessed}/${jobIds.length} jobs with comprehensive setup`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in calculate-due-dates function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});