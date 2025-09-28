import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BatchUpdateRequest {
  jobId: string;
  updates: Array<{
    stageId: string;
    quantity?: number;
    estimatedDurationMinutes?: number;
    partAssignment?: 'cover' | 'text' | 'both' | null;
    stageSpecificationId?: string | null;
    stageOrder?: number;
  }>;
}

interface WorkflowMetricsRequest {
  jobId: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();

    switch (action) {
      case 'batch-update':
        return await handleBatchUpdate(req, supabaseClient);
      case 'metrics':
        return await handleGetMetrics(req, supabaseClient);
      case 'validate':
        return await handleValidateWorkflow(req, supabaseClient);
      case 'calculate-durations':
        return await handleCalculateDurations(req, supabaseClient);
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }
  } catch (error) {
    console.error('Workflow management error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function handleBatchUpdate(req: Request, supabase: any) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  const { jobId, updates }: BatchUpdateRequest = await req.json();

  if (!jobId || !updates || !Array.isArray(updates)) {
    return new Response(
      JSON.stringify({ error: 'Invalid request body' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  // Convert updates to JSONB format for the database function
  const updateObjects = updates.map(update => ({
    stage_id: update.stageId,
    quantity: update.quantity,
    estimated_duration_minutes: update.estimatedDurationMinutes,
    part_assignment: update.partAssignment,
    stage_specification_id: update.stageSpecificationId,
    stage_order: update.stageOrder,
  }));

  const { data, error } = await supabase.rpc('batch_update_stage_instances', {
    p_job_id: jobId,
    p_updates: updateObjects,
  });

  if (error) {
    console.error('Batch update error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update stages', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  const result = data[0];
  
  return new Response(
    JSON.stringify({
      success: true,
      updatedCount: result.updated_count,
      errors: result.errors,
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

async function handleGetMetrics(req: Request, supabase: any) {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  const url = new URL(req.url);
  const jobId = url.searchParams.get('jobId');

  if (!jobId) {
    return new Response(
      JSON.stringify({ error: 'Missing jobId parameter' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  const { data, error } = await supabase.rpc('get_workflow_metrics', {
    p_job_id: jobId,
  });

  if (error) {
    console.error('Metrics error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get metrics', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  const metrics = data[0];
  
  return new Response(
    JSON.stringify({
      success: true,
      metrics: {
        totalStages: metrics.total_stages,
        completeStages: metrics.complete_stages,
        partialStages: metrics.partial_stages,
        emptyStages: metrics.empty_stages,
        totalQuantity: metrics.total_quantity,
        totalDurationMinutes: metrics.total_duration_minutes,
        estimatedCompletionDays: metrics.estimated_completion_days,
        validationStatus: metrics.validation_status,
        configurationWarnings: metrics.configuration_warnings,
      },
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

async function handleValidateWorkflow(req: Request, supabase: any) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  const { jobId } = await req.json();

  if (!jobId) {
    return new Response(
      JSON.stringify({ error: 'Missing jobId' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  // Get workflow validation results
  const { data: jobData, error: jobError } = await supabase
    .from('production_jobs')
    .select('workflow_validation_status, workflow_last_modified_at')
    .eq('id', jobId)
    .single();

  if (jobError) {
    return new Response(
      JSON.stringify({ error: 'Failed to get job data', details: jobError.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  // Get stage configuration completeness
  const { data: stageData, error: stageError } = await supabase
    .from('job_stage_instances')
    .select(`
      id,
      production_stage_id,
      configuration_completeness_score,
      quantity,
      estimated_duration_minutes,
      part_assignment,
      stage_specification_id,
      production_stages!inner(name, color)
    `)
    .eq('job_id', jobId)
    .eq('job_table_name', 'production_jobs')
    .order('stage_order');

  if (stageError) {
    return new Response(
      JSON.stringify({ error: 'Failed to get stage data', details: stageError.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  const validationIssues: string[] = [];
  const warnings: string[] = [];

  stageData?.forEach((stage: any) => {
    if (stage.configuration_completeness_score === 0) {
      validationIssues.push(`Stage "${stage.production_stages.name}" has no configuration`);
    } else if (stage.configuration_completeness_score < 100) {
      warnings.push(`Stage "${stage.production_stages.name}" has incomplete configuration`);
    }
  });

  return new Response(
    JSON.stringify({
      success: true,
      validation: {
        status: jobData.workflow_validation_status,
        lastModified: jobData.workflow_last_modified_at,
        totalStages: stageData?.length || 0,
        issues: validationIssues,
        warnings: warnings,
        isValid: validationIssues.length === 0,
      },
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

async function handleCalculateDurations(req: Request, supabase: any) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  const { jobId, stageIds } = await req.json();

  if (!jobId) {
    return new Response(
      JSON.stringify({ error: 'Missing jobId' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  // Get stage instances and their specifications
  let query = supabase
    .from('job_stage_instances')
    .select(`
      id,
      production_stage_id,
      quantity,
      stage_specification_id,
      production_stages!inner(name),
      stage_specifications(
        running_speed_per_hour,
        make_ready_time_minutes,
        speed_unit
      )
    `)
    .eq('job_id', jobId)
    .eq('job_table_name', 'production_jobs');

  if (stageIds && Array.isArray(stageIds)) {
    query = query.in('production_stage_id', stageIds);
  }

  const { data: stages, error } = await query;

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to get stage data', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  const calculations = stages?.map((stage: any) => {
    let estimatedDurationMinutes = null;
    
    if (stage.stage_specifications && stage.quantity) {
      const spec = stage.stage_specifications;
      const makeReadyTime = spec.make_ready_time_minutes || 0;
      const runningSpeed = spec.running_speed_per_hour || 0;
      
      if (runningSpeed > 0) {
        switch (spec.speed_unit) {
          case 'per_hour':
            estimatedDurationMinutes = makeReadyTime + (stage.quantity * 60.0 / runningSpeed);
            break;
          case 'per_minute':
            estimatedDurationMinutes = makeReadyTime + (stage.quantity / runningSpeed);
            break;
          default:
            estimatedDurationMinutes = makeReadyTime + 60; // Default 1 hour
        }
        
        estimatedDurationMinutes = Math.round(estimatedDurationMinutes);
      }
    }
    
    return {
      stageId: stage.production_stage_id,
      stageName: stage.production_stages.name,
      quantity: stage.quantity,
      estimatedDurationMinutes,
      hasSpecification: !!stage.stage_specifications,
    };
  }) || [];

  // Update stages with calculated durations
  const updatePromises = calculations
    .filter((calc: any) => calc.estimatedDurationMinutes !== null)
    .map((calc: any) =>
      supabase
        .from('job_stage_instances')
        .update({ estimated_duration_minutes: calc.estimatedDurationMinutes })
        .eq('job_id', jobId)
        .eq('production_stage_id', calc.stageId)
    );

  if (updatePromises.length > 0) {
    const results = await Promise.all(updatePromises);
    const updateErrors = results.filter(result => result.error);
    
    if (updateErrors.length > 0) {
      console.error('Duration update errors:', updateErrors);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to update some durations', 
          details: updateErrors.map(e => e.error.message) 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      calculations,
      updatedCount: updatePromises.length,
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}