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
          console.log(`✅ Successfully calculated due dates for ${timelines.length} jobs`);
        } else {
          results.errors.push(`Due date update error: ${updateError.message}`);
        }
      }
    } catch (dueDateError) {
      console.error(`❌ Due date calculation failed:`, dueDateError);
      results.errors.push(`Due date calculation: ${dueDateError instanceof Error ? dueDateError.message : String(dueDateError)}`);
    }
    
    console.log(`🏁 Batch processing completed:`, results);
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

    console.log(`🎯 Starting comprehensive job processing for ${jobIds.length} jobs`);
    console.log(`🔧 Options: workflows=${includeWorkflowInitialization}, timing=${includeTimingCalculation}, qr=${includeQRCodeGeneration}`);
    
    // Use larger batches for better performance
    const batchSize = 50; // Increased batch size
    const results = [];
    
    for (let i = 0; i < jobIds.length; i += batchSize) {
      const batch = jobIds.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(jobIds.length/batchSize)}: ${batch.length} jobs`);
      
      const result = await processJobBatch(supabase, batch, tableName, {
        includeWorkflowInitialization,
        includeTimingCalculation,
        includeQRCodeGeneration,
        userApprovedMappings
      });
      results.push(result);
      
      // Reduced delay for faster processing
      if (i + batchSize < jobIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
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