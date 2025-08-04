import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NightlyUpdateResult {
  success: boolean
  spillover_jobs_processed: number
  total_stage_reschedules: number
  completed_at?: string
  failed_at?: string
  error?: string
  operations_log: string[]
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🌙 Starting nightly schedule update...');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Execute the enhanced spillover detection and cascade scheduling
    const { data: updateResult, error: functionError } = await supabase
      .rpc('update_production_schedules_nightly')

    if (functionError) {
      console.error('❌ Database function failed:', functionError)
      throw functionError
    }

    const result = updateResult as NightlyUpdateResult
    
    console.log('📊 Nightly update completed:', {
      success: result.success,
      spilloverJobs: result.spillover_jobs_processed,
      totalReschedules: result.total_stage_reschedules,
      completedAt: result.completed_at || result.failed_at
    })

    // Log detailed operations for debugging
    if (result.operations_log && result.operations_log.length > 0) {
      console.log('📝 Detailed operation log:')
      result.operations_log.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log}`)
      })
    }

    // Check if there were any spillover jobs detected
    if (result.spillover_jobs_processed > 0) {
      console.log(`🚨 ALERT: ${result.spillover_jobs_processed} spillover jobs detected and rescheduled`)
      console.log(`📈 Total cascade reschedules: ${result.total_stage_reschedules}`)
      
      // TODO: Send notification to production management
      // This could be email, Slack, or in-app notification
    } else {
      console.log('✅ No spillover jobs detected - schedules are on track')
    }

    // Return success response with operation details
    return new Response(
      JSON.stringify({
        success: result.success,
        message: result.success 
          ? `Nightly update completed successfully. Processed ${result.spillover_jobs_processed} spillover jobs.`
          : `Nightly update failed: ${result.error}`,
        data: result
      }),
      {
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: result.success ? 200 : 500
      }
    )

  } catch (error) {
    console.error('💥 Edge function error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Edge function failed',
        error: error.message
      }),
      {
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 500
      }
    )
  }
})