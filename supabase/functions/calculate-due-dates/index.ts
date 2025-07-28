import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface DueDateCalculationRequest {
  jobIds: string[];
  tableName?: string;
  priority?: 'low' | 'normal' | 'high';
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

// Efficient batch job timeline calculation
async function calculateJobTimelineBatch(supabase: any, jobIds: string[], tableName: string): Promise<JobTimeline[]> {
  // Get all stage instances for these jobs in one query
  const { data: stageInstances, error: stageError } = await supabase
    .from('job_stage_instances')
    .select(`
      job_id,
      production_stage_id,
      stage_order,
      estimated_duration_minutes,
      production_stages!inner(name, color)
    `)
    .in('job_id', jobIds)
    .eq('job_table_name', tableName)
    .order('stage_order');

  if (stageError) {
    console.error('Error fetching stage instances:', stageError);
    return [];
  }

  // Get stage capacity data in batch
  const stageIds = [...new Set(stageInstances?.map(si => si.production_stage_id) || [])];
  const { data: capacityData, error: capacityError } = await supabase
    .rpc('calculate_stage_queue_workload', { stage_ids: stageIds });

  if (capacityError) {
    console.error('Error fetching capacity data:', capacityError);
  }

  // Build timelines for each job
  const timelines: JobTimeline[] = [];
  
  for (const jobId of jobIds) {
    const jobStages = stageInstances?.filter(si => si.job_id === jobId) || [];
    const stages: JobTimelineStage[] = [];
    let currentDate = new Date();
    
    for (const stage of jobStages) {
      const capacity = capacityData?.find(c => c.stage_id === stage.production_stage_id);
      const estimatedDuration = stage.estimated_duration_minutes || 60; // Default 1 hour
      const queueHours = capacity?.queue_processing_hours || 0;
      
      // Calculate start date considering queue
      const estimatedStartDate = addWorkingDays(currentDate, Math.ceil(queueHours / 8));
      
      // Calculate completion date
      const estimatedCompletionDate = addWorkingDays(estimatedStartDate, Math.ceil(estimatedDuration / 60 / 8));
      
      stages.push({
        stageId: stage.production_stage_id,
        stageName: stage.production_stages?.name || 'Unknown',
        estimatedStartDate,
        estimatedCompletionDate,
        estimatedDuration,
        queuePosition: 0
      });
      
      currentDate = estimatedCompletionDate;
    }
    
    const totalWorkingDays = stages.length > 0 
      ? calculateWorkingDaysBetween(new Date(), stages[stages.length - 1].estimatedCompletionDate)
      : 0;
    
    timelines.push({
      jobId,
      stages,
      totalEstimatedWorkingDays: totalWorkingDays,
      bottleneckStage: null,
      criticalPath: []
    });
  }
  
  return timelines;
}

async function processJobBatch(supabase: any, jobIds: string[], tableName: string) {
  console.log(`Processing batch of ${jobIds.length} jobs`);
  
  try {
    // Calculate timelines for all jobs in batch
    const timelines = await calculateJobTimelineBatch(supabase, jobIds, tableName);
    
    // Prepare batch updates
    const updates = timelines.map(timeline => {
      const lastStage = timeline.stages[timeline.stages.length - 1];
      const internalCompletionDate = lastStage?.estimatedCompletionDate || new Date();
      
      // Add 1 working day buffer
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
    
    // Batch update all jobs
    const { error: updateError } = await supabase
      .from(tableName)
      .upsert(updates, { onConflict: 'id' });
    
    if (updateError) {
      console.error('Error updating jobs:', updateError);
      return { success: false, error: updateError.message };
    }
    
    console.log(`Successfully updated ${updates.length} jobs`);
    return { success: true, updatedCount: updates.length };
    
  } catch (error) {
    console.error('Error processing job batch:', error);
    return { success: false, error: error.message };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { jobIds, tableName = 'production_jobs', priority = 'normal' }: DueDateCalculationRequest = await req.json();

    if (!jobIds || jobIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'jobIds array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting due date calculation for ${jobIds.length} jobs`);
    
    // Process jobs in smaller batches to avoid timeouts
    const batchSize = 20;
    const results = [];
    
    for (let i = 0; i < jobIds.length; i += batchSize) {
      const batch = jobIds.slice(i, i + batchSize);
      const result = await processJobBatch(supabase, batch, tableName);
      results.push(result);
      
      // Add small delay between batches to prevent overwhelming the database
      if (i + batchSize < jobIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    const successfulBatches = results.filter(r => r.success);
    const totalUpdated = successfulBatches.reduce((sum, r) => sum + (r.updatedCount || 0), 0);
    
    console.log(`Completed due date calculation. Updated ${totalUpdated} jobs`);
    
    return new Response(
      JSON.stringify({
        success: true,
        processedBatches: results.length,
        successfulBatches: successfulBatches.length,
        totalUpdated,
        results
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