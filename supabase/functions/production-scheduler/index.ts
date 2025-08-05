import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ScheduleRequest {
  action: 'calculate' | 'reschedule' | 'get_schedule' | 'update_capacity'
  data?: any
}

interface RescheduleData {
  jobId: string
  jobTableName: string
  productionStageId: string
  newDate: string
  newQueuePosition?: number
  reason?: string
}

interface CalculateData {
  startDate?: string
  endDate?: string
  calculationType?: 'nightly_full' | 'job_update' | 'capacity_change'
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, data }: ScheduleRequest = await req.json()

    console.log(`Production Scheduler: ${action} request received`, { data })

    switch (action) {
      case 'calculate': {
        const calculateData = data as CalculateData
        const startDate = calculateData?.startDate || new Date().toISOString().split('T')[0]
        const endDate = calculateData?.endDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        const calculationType = calculateData?.calculationType || 'nightly_full'

        console.log('Calculating schedules', { startDate, endDate, calculationType })

        const { data: result, error } = await supabaseClient
          .rpc('calculate_daily_schedules', {
            p_start_date: startDate,
            p_end_date: endDate,
            p_calculation_type: calculationType
          })

        if (error) {
          console.error('Schedule calculation error:', error)
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log('Schedule calculation completed:', result)
        return new Response(
          JSON.stringify({ success: true, result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'reschedule': {
        const rescheduleData = data as RescheduleData
        
        if (!rescheduleData.jobId || !rescheduleData.productionStageId || !rescheduleData.newDate) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing required reschedule parameters' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log('Rescheduling job:', rescheduleData)

        const { data: result, error } = await supabaseClient
          .rpc('reschedule_job_server_side', {
            p_job_id: rescheduleData.jobId,
            p_job_table_name: rescheduleData.jobTableName || 'production_jobs',
            p_production_stage_id: rescheduleData.productionStageId,
            p_new_date: rescheduleData.newDate,
            p_new_queue_position: rescheduleData.newQueuePosition,
            p_reason: rescheduleData.reason || 'Manual reschedule via calendar'
          })

        if (error) {
          console.error('Reschedule error:', error)
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log('Job rescheduled successfully:', result)
        return new Response(
          JSON.stringify({ success: true, result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'get_schedule': {
        const { startDate, endDate } = data || {}
        const start = startDate || new Date().toISOString().split('T')[0]
        const end = endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

        console.log('Fetching schedule data', { start, end })

        // Get job assignments
        const { data: assignments, error: assignmentsError } = await supabaseClient
          .from('job_schedule_assignments')
          .select(`
            *,
            production_stages!inner(id, name, color),
            production_jobs!left(id, wo_no, customer, status, category_id)
          `)
          .gte('scheduled_date', start)
          .lte('scheduled_date', end)
          .eq('status', 'scheduled')
          .order('scheduled_date', { ascending: true })
          .order('queue_position', { ascending: true })

        if (assignmentsError) {
          console.error('Error fetching assignments:', assignmentsError)
          return new Response(
            JSON.stringify({ success: false, error: assignmentsError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Get daily capacity data
        const { data: dailySchedules, error: scheduleError } = await supabaseClient
          .from('daily_production_schedule')
          .select(`
            *,
            production_stages!inner(id, name, color)
          `)
          .gte('date', start)
          .lte('date', end)
          .order('date', { ascending: true })

        if (scheduleError) {
          console.error('Error fetching daily schedules:', scheduleError)
          return new Response(
            JSON.stringify({ success: false, error: scheduleError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log(`Fetched ${assignments?.length || 0} assignments and ${dailySchedules?.length || 0} daily schedules`)

        return new Response(
          JSON.stringify({ 
            success: true, 
            assignments: assignments || [], 
            dailySchedules: dailySchedules || [] 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'update_capacity': {
        const { stageId, date, newCapacityMinutes } = data || {}
        
        if (!stageId || !date || !newCapacityMinutes) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing capacity update parameters' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log('Updating stage capacity', { stageId, date, newCapacityMinutes })

        const { error } = await supabaseClient
          .from('daily_production_schedule')
          .upsert({
            date,
            production_stage_id: stageId,
            total_capacity_minutes: newCapacityMinutes,
            shift_number: 1
          })

        if (error) {
          console.error('Capacity update error:', error)
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Trigger recalculation for affected dates
        const { error: recalcError } = await supabaseClient
          .rpc('calculate_daily_schedules', {
            p_start_date: date,
            p_end_date: date,
            p_calculation_type: 'capacity_change'
          })

        if (recalcError) {
          console.warn('Recalculation warning:', recalcError)
        }

        console.log('Capacity updated successfully')
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

  } catch (error) {
    console.error('Production scheduler error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})