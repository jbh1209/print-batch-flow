import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SchedulingRequest {
  job_id: string
  job_table_name: string
  trigger_reason: 'job_approved' | 'admin_expedite' | 'nightly_reconciliation'
}

interface StageSchedule {
  stage_instance_id: string
  production_stage_id: string
  stage_name: string
  stage_order: number
  estimated_duration_minutes: number
  dependencies: string[]
  stage_group_id?: string
  parallel_processing_enabled: boolean
  part_assignment?: string
}

interface TimeSlot {
  start_time: Date
  end_time: Date
  duration_minutes: number
  is_split: boolean
  split_part?: number
  total_parts?: number
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

    const { job_id, job_table_name, trigger_reason }: SchedulingRequest = await req.json()

    console.log(`🎯 Auto-scheduler triggered: ${trigger_reason} for job ${job_id}`)

    // Step 1: Get job's stage breakdown from category workflow
    const stageBreakdown = await getJobStageBreakdown(supabase, job_id, job_table_name)
    
    if (!stageBreakdown.length) {
      throw new Error('No stages found for job')
    }

    console.log(`📋 Found ${stageBreakdown.length} stages to schedule`)

    // Step 2: Process stages in dependency order (sequential + parallel groups)
    const scheduledSlots = await scheduleStagesInOrder(supabase, stageBreakdown)

    // Step 3: Update job_stage_instances with exact scheduled times
    await updateStageInstancesWithSchedule(supabase, scheduledSlots, job_id, job_table_name)

    // Step 4: Create time slot records for queue tracking
    await createTimeSlotRecords(supabase, scheduledSlots, job_id, job_table_name)

    console.log(`✅ Successfully scheduled ${scheduledSlots.length} time slots for job ${job_id}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        scheduled_slots: scheduledSlots.length,
        message: `Job ${job_id} scheduled successfully`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('❌ Auto-scheduler error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

// Get job's stage breakdown from category workflow
async function getJobStageBreakdown(supabase: any, jobId: string, jobTableName: string): Promise<StageSchedule[]> {
  const { data: stages, error } = await supabase
    .from('job_stage_instances')
    .select(`
      id,
      production_stage_id,
      stage_order,
      estimated_duration_minutes,
      part_assignment,
      production_stages!inner(
        name,
        stage_group_id,
        stage_groups(
          parallel_processing_enabled
        )
      )
    `)
    .eq('job_id', jobId)
    .eq('job_table_name', jobTableName)
    .order('stage_order', { ascending: true })

  if (error) throw error

  return stages.map(stage => ({
    stage_instance_id: stage.id,
    production_stage_id: stage.production_stage_id,
    stage_name: stage.production_stages.name,
    stage_order: stage.stage_order,
    estimated_duration_minutes: stage.estimated_duration_minutes || 60, // Default 1 hour
    dependencies: [], // Will be calculated based on stage_order and parallel groups
    stage_group_id: stage.production_stages.stage_group_id,
    parallel_processing_enabled: stage.production_stages.stage_groups?.parallel_processing_enabled || false,
    part_assignment: stage.part_assignment
  }))
}

// Schedule stages respecting dependencies and parallel processing
async function scheduleStagesInOrder(supabase: any, stages: StageSchedule[]): Promise<(StageSchedule & TimeSlot)[]> {
  const scheduledSlots: (StageSchedule & TimeSlot)[] = []
  const parallelGroups: Map<string, StageSchedule[]> = new Map()

  // Group parallel stages together
  for (const stage of stages) {
    if (stage.parallel_processing_enabled && stage.stage_group_id) {
      const groupKey = `${stage.stage_order}-${stage.stage_group_id}`
      if (!parallelGroups.has(groupKey)) {
        parallelGroups.set(groupKey, [])
      }
      parallelGroups.get(groupKey)!.push(stage)
    }
  }

  let lastCompletionTime = new Date()

  for (const stage of stages) {
    if (stage.parallel_processing_enabled && stage.stage_group_id) {
      // Handle parallel stages as a group
      const groupKey = `${stage.stage_order}-${stage.stage_group_id}`
      const groupStages = parallelGroups.get(groupKey)

      if (groupStages && !scheduledSlots.find(s => s.stage_group_id === stage.stage_group_id && s.stage_order === stage.stage_order)) {
        // Schedule all stages in parallel group simultaneously
        const parallelSlots = await scheduleParallelGroup(supabase, groupStages, lastCompletionTime)
        scheduledSlots.push(...parallelSlots)
        
        // Next stage waits for the longest parallel stage to complete
        lastCompletionTime = new Date(Math.max(...parallelSlots.map(slot => slot.end_time.getTime())))
      }
    } else {
      // Handle sequential stage
      const timeSlot = await findNextAvailableSlot(supabase, stage.production_stage_id, stage.estimated_duration_minutes, lastCompletionTime)
      
      scheduledSlots.push({
        ...stage,
        ...timeSlot
      })

      lastCompletionTime = timeSlot.end_time
    }
  }

  return scheduledSlots
}

// Schedule parallel stages (COVER + TEXT) simultaneously
async function scheduleParallelGroup(supabase: any, groupStages: StageSchedule[], earliestStart: Date): Promise<(StageSchedule & TimeSlot)[]> {
  const parallelSlots: (StageSchedule & TimeSlot)[] = []

  for (const stage of groupStages) {
    const timeSlot = await findNextAvailableSlot(supabase, stage.production_stage_id, stage.estimated_duration_minutes, earliestStart)
    
    parallelSlots.push({
      ...stage,
      ...timeSlot
    })
  }

  return parallelSlots
}

// Find first available time slot for a stage (Tetris logic)
async function findNextAvailableSlot(supabase: any, stageId: string, durationMinutes: number, earliestStart: Date): Promise<TimeSlot> {
  // Get working hours for the day
  const workingHours = await getWorkingHours(supabase, earliestStart)
  
  // Get current queue end time for this stage
  const currentQueueEnd = await getCurrentQueueEndTime(supabase, stageId, earliestStart)
  
  // Start time is the later of earliestStart or current queue end
  const startTime = new Date(Math.max(earliestStart.getTime(), currentQueueEnd.getTime()))
  
  // Calculate end time
  const proposedEndTime = new Date(startTime.getTime() + (durationMinutes * 60 * 1000))
  
  // Check if job fits within working hours
  const dayEndTime = workingHours.end_time
  
  if (proposedEndTime <= dayEndTime) {
    // Job fits in current day
    return {
      start_time: startTime,
      end_time: proposedEndTime,
      duration_minutes: durationMinutes,
      is_split: false
    }
  } else {
    // Job needs to be split across days
    const remainingMinutesInDay = Math.floor((dayEndTime.getTime() - startTime.getTime()) / (60 * 1000))
    const remainingMinutesNextDay = durationMinutes - remainingMinutesInDay
    
    if (remainingMinutesInDay > 0) {
      // Split job: part 1 today, part 2 tomorrow
      return {
        start_time: startTime,
        end_time: dayEndTime,
        duration_minutes: remainingMinutesInDay,
        is_split: true,
        split_part: 1,
        total_parts: 2
      }
      // Note: Part 2 would be scheduled in a separate call
    } else {
      // No time left today, schedule for next working day
      const nextWorkingDay = await getNextWorkingDay(supabase, earliestStart)
      return {
        start_time: nextWorkingDay.start_time,
        end_time: new Date(nextWorkingDay.start_time.getTime() + (durationMinutes * 60 * 1000)),
        duration_minutes: durationMinutes,
        is_split: false
      }
    }
  }
}

// Get working hours for a specific date
async function getWorkingHours(supabase: any, date: Date) {
  const dayOfWeek = date.getDay() // 0=Sunday, 1=Monday, etc
  
  const { data, error } = await supabase
    .from('shift_schedules')
    .select('shift_start_time, shift_end_time, is_working_day')
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)
    .single()

  if (error || !data.is_working_day) {
    // Non-working day, find next working day
    return await getNextWorkingDay(supabase, date)
  }

  const dateStr = date.toISOString().split('T')[0]
  const startTime = new Date(`${dateStr}T${data.shift_start_time}`)
  const endTime = new Date(`${dateStr}T${data.shift_end_time}`)

  return {
    start_time: startTime,
    end_time: endTime,
    is_working_day: true
  }
}

// Get next working day
async function getNextWorkingDay(supabase: any, fromDate: Date) {
  let checkDate = new Date(fromDate)
  checkDate.setDate(checkDate.getDate() + 1)

  for (let i = 0; i < 7; i++) { // Check up to 7 days ahead
    const dayOfWeek = checkDate.getDay()
    
    const { data } = await supabase
      .from('shift_schedules')
      .select('shift_start_time, shift_end_time, is_working_day')
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .single()

    if (data && data.is_working_day) {
      const dateStr = checkDate.toISOString().split('T')[0]
      return {
        start_time: new Date(`${dateStr}T${data.shift_start_time}`),
        end_time: new Date(`${dateStr}T${data.shift_end_time}`),
        is_working_day: true
      }
    }

    checkDate.setDate(checkDate.getDate() + 1)
  }

  throw new Error('No working days found in next 7 days')
}

// Get current queue end time for a stage
async function getCurrentQueueEndTime(supabase: any, stageId: string, fromDate: Date): Promise<Date> {
  const { data } = await supabase
    .from('stage_time_slots')
    .select('slot_end_time')
    .eq('production_stage_id', stageId)
    .gte('slot_start_time', fromDate.toISOString())
    .order('slot_end_time', { ascending: false })
    .limit(1)

  if (data && data.length > 0) {
    return new Date(data[0].slot_end_time)
  }

  return fromDate
}

// Update job_stage_instances with scheduled times
async function updateStageInstancesWithSchedule(supabase: any, scheduledSlots: (StageSchedule & TimeSlot)[], jobId: string, jobTableName: string) {
  for (const slot of scheduledSlots) {
    await supabase
      .from('job_stage_instances')
      .update({
        auto_scheduled_start_at: slot.start_time.toISOString(),
        auto_scheduled_end_at: slot.end_time.toISOString(),
        auto_scheduled_duration_minutes: slot.duration_minutes,
        is_split_job: slot.is_split,
        split_job_part: slot.split_part || 1,
        split_job_total_parts: slot.total_parts || 1
      })
      .eq('id', slot.stage_instance_id)
  }
}

// Create time slot records for queue tracking
async function createTimeSlotRecords(supabase: any, scheduledSlots: (StageSchedule & TimeSlot)[], jobId: string, jobTableName: string) {
  const timeSlotRecords = scheduledSlots.map(slot => ({
    production_stage_id: slot.production_stage_id,
    date: slot.start_time.toISOString().split('T')[0],
    slot_start_time: slot.start_time.toISOString(),
    slot_end_time: slot.end_time.toISOString(),
    duration_minutes: slot.duration_minutes,
    job_id: jobId,
    job_table_name: jobTableName,
    stage_instance_id: slot.stage_instance_id
  }))

  await supabase
    .from('stage_time_slots')
    .insert(timeSlotRecords)
}