import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🌙 Starting nightly reconciliation...')

    // Step 1: Find incomplete jobs from previous shift
    const incompleteJobs = await findIncompleteJobs(supabase)
    
    if (incompleteJobs.length === 0) {
      console.log('✅ No incomplete jobs found - all on schedule!')
      return new Response(
        JSON.stringify({ success: true, message: 'No incomplete jobs found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📋 Found ${incompleteJobs.length} incomplete jobs to reschedule`)

    // Step 2: Move incomplete work to beginning of next shift
    let rescheduledCount = 0
    for (const job of incompleteJobs) {
      await moveIncompleteJobToNextShift(supabase, job)
      rescheduledCount++
    }

    // Step 3: Cascade delay all subsequent jobs
    await cascadeDelaySubsequentJobs(supabase, incompleteJobs)

    console.log(`✅ Nightly reconciliation complete: ${rescheduledCount} jobs rescheduled`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        rescheduled_jobs: rescheduledCount,
        message: `${rescheduledCount} incomplete jobs moved to next shift`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Nightly reconciliation error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

// Find jobs that should have completed but didn't
async function findIncompleteJobs(supabase: any) {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  const { data: incompleteSlots, error } = await supabase
    .from('stage_time_slots')
    .select(`
      *,
      job_stage_instances!inner(
        id,
        job_id,
        job_table_name,
        production_stage_id,
        stage_order,
        status
      )
    `)
    .eq('date', yesterdayStr)
    .eq('is_completed', false)
    .lt('slot_end_time', new Date().toISOString())
    .order('slot_start_time', { ascending: true })

  if (error) throw error

  return incompleteSlots || []
}

// Move incomplete job to beginning of next working shift
async function moveIncompleteJobToNextShift(supabase: any, incompleteJob: any) {
  const nextShiftStart = await getNextShiftStart(supabase)
  
  // Calculate remaining duration
  const originalDuration = incompleteJob.duration_minutes
  const timeSpent = Math.max(0, Math.floor(
    (new Date().getTime() - new Date(incompleteJob.slot_start_time).getTime()) / (60 * 1000)
  ))
  const remainingDuration = Math.max(30, originalDuration - timeSpent) // Minimum 30 minutes

  console.log(`📦 Moving job ${incompleteJob.job_id} - ${remainingDuration} minutes remaining`)

  // Delete old time slot
  await supabase
    .from('stage_time_slots')
    .delete()
    .eq('id', incompleteJob.id)

  // Create new time slot at beginning of next shift
  const newEndTime = new Date(nextShiftStart.getTime() + (remainingDuration * 60 * 1000))

  await supabase
    .from('stage_time_slots')
    .insert({
      production_stage_id: incompleteJob.production_stage_id,
      date: nextShiftStart.toISOString().split('T')[0],
      slot_start_time: nextShiftStart.toISOString(),
      slot_end_time: newEndTime.toISOString(),
      duration_minutes: remainingDuration,
      job_id: incompleteJob.job_id,
      job_table_name: incompleteJob.job_table_name,
      stage_instance_id: incompleteJob.job_stage_instances.id,
      is_completed: false
    })

  // Update job_stage_instances with new schedule
  await supabase
    .from('job_stage_instances')
    .update({
      auto_scheduled_start_at: nextShiftStart.toISOString(),
      auto_scheduled_end_at: newEndTime.toISOString(),
      auto_scheduled_duration_minutes: remainingDuration
    })
    .eq('id', incompleteJob.job_stage_instances.id)
}

// Push all subsequent jobs back to accommodate incomplete work
async function cascadeDelaySubsequentJobs(supabase: any, incompleteJobs: any[]) {
  // Group by production stage to handle delays per stage queue
  const stageDelays = new Map<string, number>()

  for (const job of incompleteJobs) {
    const stageId = job.production_stage_id
    const delayMinutes = job.duration_minutes
    
    if (!stageDelays.has(stageId)) {
      stageDelays.set(stageId, 0)
    }
    stageDelays.set(stageId, stageDelays.get(stageId)! + delayMinutes)
  }

  // For each affected stage, push all future jobs back
  for (const [stageId, totalDelayMinutes] of stageDelays) {
    console.log(`⏰ Pushing ${stageId} queue back by ${totalDelayMinutes} minutes`)

    const { data: futureSlots } = await supabase
      .from('stage_time_slots')
      .select('*')
      .eq('production_stage_id', stageId)
      .gte('slot_start_time', new Date().toISOString())
      .order('slot_start_time', { ascending: true })

    if (futureSlots) {
      for (const slot of futureSlots) {
        const newStartTime = new Date(new Date(slot.slot_start_time).getTime() + (totalDelayMinutes * 60 * 1000))
        const newEndTime = new Date(new Date(slot.slot_end_time).getTime() + (totalDelayMinutes * 60 * 1000))

        await supabase
          .from('stage_time_slots')
          .update({
            slot_start_time: newStartTime.toISOString(),
            slot_end_time: newEndTime.toISOString()
          })
          .eq('id', slot.id)

        // Update corresponding job_stage_instance
        if (slot.stage_instance_id) {
          await supabase
            .from('job_stage_instances')
            .update({
              auto_scheduled_start_at: newStartTime.toISOString(),
              auto_scheduled_end_at: newEndTime.toISOString()
            })
            .eq('id', slot.stage_instance_id)
        }
      }
    }
  }
}

// Get next working shift start time
async function getNextShiftStart(supabase: any): Promise<Date> {
  const today = new Date()
  let checkDate = new Date(today)

  for (let i = 0; i < 7; i++) {
    const dayOfWeek = checkDate.getDay()
    
    const { data } = await supabase
      .from('shift_schedules')
      .select('shift_start_time, is_working_day')
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .single()

    if (data && data.is_working_day) {
      const dateStr = checkDate.toISOString().split('T')[0]
      const shiftStart = new Date(`${dateStr}T${data.shift_start_time}`)
      
      // If it's today and shift hasn't started yet, use today
      if (i === 0 && shiftStart > today) {
        return shiftStart
      }
      
      // If it's a future day, use that
      if (i > 0) {
        return shiftStart
      }
    }

    checkDate.setDate(checkDate.getDate() + 1)
  }

  throw new Error('No working days found in next 7 days')
}