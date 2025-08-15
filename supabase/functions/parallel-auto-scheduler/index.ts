import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

interface SchedulingRequest {
  job_id: string
  job_table_name: string
  trigger_reason: string
}

interface StageCapacity {
  stage_id: string
  daily_capacity_minutes: number
  working_start_hour: number
  working_end_hour: number
}

interface SchedulingSlot {
  job_id: string
  stage_id: string
  scheduled_start: string // SAST ISO string
  scheduled_end: string   // SAST ISO string
  estimated_minutes: number
  capacity_date: string   // yyyy-MM-dd
}

/**
 * **PARALLEL CAPACITY AUTO-SCHEDULER**
 * Replaces broken sequential scheduler with capacity-aware parallel scheduling
 * Fixes "Monday to Friday" scheduling gaps by packing jobs within daily capacity
 */
serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { job_id, job_table_name = 'production_jobs', trigger_reason } = await req.json() as SchedulingRequest

    console.log(`🚀 **PARALLEL SCHEDULER START** - Job: ${job_id}, Reason: ${trigger_reason}`)

    // STEP 1: Get stage capacities from database
    const { data: capacityData, error: capacityError } = await supabase
      .from('stage_capacity_profiles')
      .select(`
        production_stage_id,
        daily_capacity_hours,
        working_days_per_week,
        shift_hours_per_day
      `)

    if (capacityError) {
      throw new Error(`Failed to load stage capacities: ${capacityError.message}`)
    }

    // Convert to capacity map
    const stageCapacities = new Map<string, StageCapacity>()
    for (const capacity of capacityData || []) {
      stageCapacities.set(capacity.production_stage_id, {
        stage_id: capacity.production_stage_id,
        daily_capacity_minutes: capacity.daily_capacity_hours * 60,
        working_start_hour: 8,   // 8 AM SAST
        working_end_hour: 17.5   // 5:30 PM SAST
      })
    }

    console.log(`📊 Loaded ${stageCapacities.size} stage capacity profiles`)

    // STEP 2: Get job's pending/active stages (EXCLUDE DTP, Proof, Batch Allocation)
    const { data: jobStages, error: stagesError } = await supabase
      .from('job_stage_instances')
      .select(`
        id,
        production_stage_id,
        stage_order,
        estimated_duration_minutes,
        production_stages!inner(name, is_active)
      `)
      .eq('job_id', job_id)
      .eq('job_table_name', job_table_name)
      .in('status', ['pending', 'active'])
      .neq('production_stages.name', 'DTP')
      .neq('production_stages.name', 'Proof')
      .neq('production_stages.name', 'Batch Allocation')
      .eq('production_stages.is_active', true)
      .order('stage_order')

    if (stagesError) {
      throw new Error(`Failed to get job stages: ${stagesError.message}`)
    }

    if (!jobStages || jobStages.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No schedulable stages found for job',
        scheduled_slots: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`📋 Found ${jobStages.length} schedulable stages for job ${job_id}`)

    // STEP 3 FIX: Use proper SAST timezone utilities
    const sastNow = new Date()
    // TODO: Import proper timezone utils from '../../../src/utils/timezone.ts'
    // For now, keep +2 but mark for fix
    sastNow.setHours(sastNow.getHours() + 2) // TEMP: Manual SAST conversion
    const currentSAST = sastNow.toISOString()
    
    console.log(`🕐 Current SAST time: ${currentSAST}`)

    // STEP 4: Schedule each stage using parallel capacity logic
    const scheduledSlots: SchedulingSlot[] = []
    let lastScheduledEnd = sastNow

    for (const stage of jobStages) {
      const stageCapacity = stageCapacities.get(stage.production_stage_id)
      const estimatedMinutes = stage.estimated_duration_minutes || 120 // 2 hours default

      console.log(`🔍 Scheduling stage ${stage.production_stages?.name} (${estimatedMinutes} min)`)

      if (!stageCapacity) {
        console.warn(`⚠️ No capacity profile for stage ${stage.production_stage_id}, using defaults`)
        // Use 8-hour default capacity
        stageCapacities.set(stage.production_stage_id, {
          stage_id: stage.production_stage_id,
          daily_capacity_minutes: 480, // 8 hours
          working_start_hour: 8,
          working_end_hour: 17.5
        })
      }

      // Find next available capacity slot
      const slot = await findNextCapacitySlot(
        supabase,
        stage.production_stage_id,
        estimatedMinutes,
        lastScheduledEnd,
        stageCapacities.get(stage.production_stage_id)!
      )

      if (slot) {
        scheduledSlots.push({
          job_id: job_id,
          stage_id: stage.production_stage_id,
          scheduled_start: slot.start,
          scheduled_end: slot.end,
          estimated_minutes: estimatedMinutes,
          capacity_date: slot.date
        })

        lastScheduledEnd = new Date(slot.end)
        console.log(`✅ Scheduled ${stage.production_stages?.name}: ${slot.start.split('T')[1].substring(0,5)}-${slot.end.split('T')[1].substring(0,5)} on ${slot.date}`)
      } else {
        console.error(`❌ No capacity found for stage ${stage.production_stage_id}`)
      }
    }

    // STEP 5: Update job_stage_instances with scheduled times
    let updateCount = 0
    for (const slot of scheduledSlots) {
      const { error: updateError } = await supabase
        .from('job_stage_instances')
        .update({
          auto_scheduled_start_at: slot.scheduled_start,
          auto_scheduled_end_at: slot.scheduled_end,
          auto_scheduled_duration_minutes: slot.estimated_minutes,
          schedule_status: 'auto_scheduled',  // STEP 3 FIX: Always set status
          updated_at: new Date().toISOString()
        })
        .eq('job_id', slot.job_id)
        .eq('production_stage_id', slot.stage_id)

      if (updateError) {
        console.error(`❌ Failed to update stage ${slot.stage_id}:`, updateError)
        // STEP 3 FIX: Don't fail silently - log detailed error
        console.error(`Update details:`, { 
          job_id: slot.job_id, 
          stage_id: slot.stage_id, 
          start: slot.scheduled_start,
          end: slot.scheduled_end,
          error: updateError 
        })
      } else {
        updateCount++
        console.log(`✅ Updated stage ${slot.stage_id} for job ${slot.job_id}`)
      }
    }

    console.log(`🎯 **PARALLEL SCHEDULER COMPLETE** - Updated ${updateCount}/${scheduledSlots.length} stages`)

    return new Response(JSON.stringify({
      success: true,
      message: `Scheduled ${scheduledSlots.length} stages using parallel capacity logic`,
      scheduled_slots: scheduledSlots.length,
      slots: scheduledSlots
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Parallel scheduler error:', error)
    
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown scheduling error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

/**
 * **CORE CAPACITY LOGIC: Find next available slot within daily capacity**
 * This is the KEY fix that prevents "Monday to Friday" gaps
 */
async function findNextCapacitySlot(
  supabase: any,
  stageId: string,
  requiredMinutes: number,
  earliestStart: Date,
  capacity: StageCapacity
): Promise<{ start: string; end: string; date: string } | null> {
  
  // Try each working day until we find capacity
  let currentDay = new Date(earliestStart)
  
  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const dayToCheck = new Date(currentDay)
    dayToCheck.setDate(currentDay.getDate() + dayOffset)
    
    // Skip weekends
    const dayOfWeek = dayToCheck.getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) continue
    
    const dateStr = dayToCheck.toISOString().split('T')[0] // yyyy-MM-dd
    
    // Get already used capacity for this stage on this date
    const { data: existingJobs } = await supabase
      .from('job_stage_instances')
      .select('auto_scheduled_duration_minutes, scheduled_minutes')
      .eq('production_stage_id', stageId)
      .in('status', ['pending', 'active'])
      .or(`auto_scheduled_start_at::date.eq.${dateStr},scheduled_start_at::date.eq.${dateStr}`)
    
    const usedMinutes = (existingJobs || []).reduce((total: number, job: any) => {
      return total + (job.auto_scheduled_duration_minutes || job.scheduled_minutes || 0)
    }, 0)
    
    const availableMinutes = capacity.daily_capacity_minutes - usedMinutes
    
    console.log(`[CAPACITY] Stage ${stageId} on ${dateStr}: ${usedMinutes}/${capacity.daily_capacity_minutes} min used (${availableMinutes} available)`)
    
    // Check if this day has enough capacity
    if (availableMinutes >= requiredMinutes) {
      // Calculate slot start time: working start + used time
      const slotStart = new Date(dayToCheck)
      slotStart.setHours(capacity.working_start_hour, 0, 0, 0)
      slotStart.setMinutes(slotStart.getMinutes() + usedMinutes)
      
      const slotEnd = new Date(slotStart)
      slotEnd.setMinutes(slotEnd.getMinutes() + requiredMinutes)
      
      // Check if slot fits within working hours
      const workingEndHour = capacity.working_start_hour + (capacity.daily_capacity_minutes / 60)
      const slotEndHour = slotEnd.getHours() + (slotEnd.getMinutes() / 60)
      
      if (slotEndHour <= workingEndHour) {
        return {
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          date: dateStr
        }
      }
    }
  }
  
  return null // No capacity found in 30 days
}