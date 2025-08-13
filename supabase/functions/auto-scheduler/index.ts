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

// Core scheduling context - NEVER schedule in the past
interface SchedulingContext {
  currentTime: Date
  serverTime: Date
  timezone: string
}

function createSchedulingContext(): SchedulingContext {
  const serverTime = new Date()
  // Create proper SAST time (UTC+2)
  const sastTime = new Date(serverTime.getTime() + (2 * 60 * 60 * 1000))
  return {
    currentTime: sastTime,
    serverTime: sastTime,
    timezone: 'Africa/Johannesburg'
  }
}

// Get the scheduling start time - start from tomorrow 08:00 SAST
function getSchedulingStartTime(context: SchedulingContext, proposedStart?: Date): Date {
  const now = context.currentTime
  // If it's after 4:30 PM or any time today, start tomorrow at 8 AM
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(8, 0, 0, 0) // 08:00:00 SAST
  
  if (!proposedStart || proposedStart < tomorrow) {
    return tomorrow
  }
  return proposedStart
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

    // CRITICAL: Create scheduling context with current server time
    const schedulingContext = createSchedulingContext()
    
    console.log(`🎯 Auto-scheduler triggered: ${trigger_reason} for job ${job_id} at ${schedulingContext.currentTime.toISOString()}`)

    // Step 1: Get job's stage breakdown from category workflow
    const stageBreakdown = await getJobStageBreakdown(supabase, job_id, job_table_name)
    
    if (!stageBreakdown.length) {
      throw new Error('No stages found for job')
    }

    console.log(`📋 Found ${stageBreakdown.length} stages to schedule`)

    // Step 2: Process stages in dependency order (sequential + parallel groups)
    const scheduledSlots = await scheduleStagesInOrder(supabase, stageBreakdown, schedulingContext)

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

// Get job's stage breakdown - only for jobs approved at PROOF stage
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

  // Filter out DTP and Proof stages - only schedule printing/finishing stages
  const productionStages = stages.filter(stage => {
    const stageName = stage.production_stages.name.toLowerCase()
    return !stageName.includes('dtp') && !stageName.includes('proof') && !stageName.includes('batch allocation')
  })

  return productionStages.map(stage => ({
    stage_instance_id: stage.id,
    production_stage_id: stage.production_stage_id,
    stage_name: stage.production_stages.name,
    stage_order: stage.stage_order,
    estimated_duration_minutes: stage.estimated_duration_minutes || 60,
    dependencies: [],
    stage_group_id: stage.production_stages.stage_group_id,
    parallel_processing_enabled: stage.production_stages.stage_groups?.parallel_processing_enabled || false,
    part_assignment: stage.part_assignment
  }))
}

// Schedule stages respecting dependencies and parallel processing
async function scheduleStagesInOrder(supabase: any, stages: StageSchedule[], context: SchedulingContext): Promise<(StageSchedule & TimeSlot)[]> {
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

  // CRITICAL: Start from current time, never in the past
  let lastCompletionTime = getSchedulingStartTime(context)

  for (const stage of stages) {
    if (stage.parallel_processing_enabled && stage.stage_group_id) {
      // Handle parallel stages as a group
      const groupKey = `${stage.stage_order}-${stage.stage_group_id}`
      const groupStages = parallelGroups.get(groupKey)

      if (groupStages && !scheduledSlots.find(s => s.stage_group_id === stage.stage_group_id && s.stage_order === stage.stage_order)) {
        // Schedule all stages in parallel group simultaneously
        const parallelSlots = await scheduleParallelGroup(supabase, groupStages, lastCompletionTime, context)
        scheduledSlots.push(...parallelSlots)
        
        // Next stage waits for the longest parallel stage to complete
        lastCompletionTime = new Date(Math.max(...parallelSlots.map(slot => slot.end_time.getTime())))
      }
    } else {
      // Handle sequential stage
      const timeSlot = await findNextAvailableSlot(supabase, stage.production_stage_id, stage.estimated_duration_minutes, lastCompletionTime, context)
      
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
async function scheduleParallelGroup(supabase: any, groupStages: StageSchedule[], earliestStart: Date, context: SchedulingContext): Promise<(StageSchedule & TimeSlot)[]> {
  const parallelSlots: (StageSchedule & TimeSlot)[] = []

  for (const stage of groupStages) {
    const timeSlot = await findNextAvailableSlot(supabase, stage.production_stage_id, stage.estimated_duration_minutes, earliestStart, context)
    
    parallelSlots.push({
      ...stage,
      ...timeSlot
    })
  }

  return parallelSlots
}

// Find first available time slot for a stage (Tetris logic)
async function findNextAvailableSlot(supabase: any, stageId: string, durationMinutes: number, earliestStart: Date, context: SchedulingContext): Promise<TimeSlot> {
  // CRITICAL: Never schedule in the past
  const schedulingStartTime = getSchedulingStartTime(context, earliestStart)
  
  console.log(`🔍 Finding slot for stage ${stageId}: duration=${durationMinutes}min, requestedStart=${earliestStart.toISOString()}, actualStart=${schedulingStartTime.toISOString()}`)
  
  // Get current queue end time for this stage (only future slots)
  const currentQueueEnd = await getCurrentQueueEndTime(supabase, stageId, schedulingStartTime)
  
  // Start time must be: MAX(currentTime, requestedStart, queueEnd)
  const startTime = new Date(Math.max(
    schedulingStartTime.getTime(),
    currentQueueEnd.getTime()
  ))
  
  console.log(`⏰ Calculated start time: ${startTime.toISOString()} (queue ends: ${currentQueueEnd.toISOString()})`)
  
  // Get working hours for the start day
  const workingHours = await getWorkingHours(supabase, startTime)
  
  // Ensure start time is within working hours
  const validStartTime = await ensureWithinWorkingHours(supabase, startTime, workingHours)
  
  // Calculate proposed end time
  const proposedEndTime = new Date(validStartTime.getTime() + (durationMinutes * 60 * 1000))
  
  // Validate against working hours
  const validatedSlot = await validateWorkingHoursSlot(supabase, validStartTime, proposedEndTime, durationMinutes)
  
  console.log(`✅ Scheduled slot: ${validatedSlot.start_time.toISOString()} to ${validatedSlot.end_time.toISOString()}`)
  
  return validatedSlot
}

// Ensure start time is within working hours
async function ensureWithinWorkingHours(supabase: any, proposedStart: Date, workingHours: any): Promise<Date> {
  if (!workingHours.is_working_day) {
    // Move to next working day
    const nextWorkingDay = await getNextWorkingDay(supabase, proposedStart)
    return nextWorkingDay.start_time
  }
  
  // Check if proposed start is before working hours start
  if (proposedStart < workingHours.start_time) {
    return workingHours.start_time
  }
  
  // Check if proposed start is after working hours end
  if (proposedStart >= workingHours.end_time) {
    // Move to next working day
    const nextWorkingDay = await getNextWorkingDay(supabase, proposedStart)
    return nextWorkingDay.start_time
  }
  
  return proposedStart
}

// Validate that a time slot fits within working hours
async function validateWorkingHoursSlot(supabase: any, startTime: Date, endTime: Date, durationMinutes: number): Promise<TimeSlot> {
  const workingHours = await getWorkingHours(supabase, startTime)
  
  // Check if the entire job fits within the working day
  if (endTime <= workingHours.end_time) {
    // Job fits completely
    return {
      start_time: startTime,
      end_time: endTime,
      duration_minutes: durationMinutes,
      is_split: false
    }
  }
  
  // Job extends beyond working hours
  const availableMinutesToday = Math.floor((workingHours.end_time.getTime() - startTime.getTime()) / (60 * 1000))
  
  if (availableMinutesToday <= 0) {
    // No time left today, move to next working day
    const nextWorkingDay = await getNextWorkingDay(supabase, startTime)
    return {
      start_time: nextWorkingDay.start_time,
      end_time: new Date(nextWorkingDay.start_time.getTime() + (durationMinutes * 60 * 1000)),
      duration_minutes: durationMinutes,
      is_split: false
    }
  }
  
  // Split the job - use only available time today
  return {
    start_time: startTime,
    end_time: workingHours.end_time,
    duration_minutes: availableMinutesToday,
    is_split: true,
    split_part: 1,
    total_parts: 2
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
  const startTime = new Date(`${dateStr}T${data.shift_start_time}+02:00`)
  const endTime = new Date(`${dateStr}T${data.shift_end_time}+02:00`)

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
        start_time: new Date(`${dateStr}T${data.shift_start_time}+02:00`),
        end_time: new Date(`${dateStr}T${data.shift_end_time}+02:00`),
        is_working_day: true
      }
    }

    checkDate.setDate(checkDate.getDate() + 1)
  }

  throw new Error('No working days found in next 7 days')
}

// Get current queue end time for a stage - Simple sequential logic
async function getCurrentQueueEndTime(supabase: any, stageId: string, fromTime: Date): Promise<Date> {
  // Simple logic: Find the last job that ends latest for this stage
  const { data } = await supabase
    .from('stage_time_slots')
    .select('slot_end_time')
    .eq('production_stage_id', stageId)
    .gte('slot_start_time', fromTime.toISOString())
    .order('slot_end_time', { ascending: false })
    .limit(1)

  if (data && data.length > 0) {
    const lastEndTime = new Date(data[0].slot_end_time)
    // Ensure we never return a time before now
    const result = lastEndTime > fromTime ? lastEndTime : fromTime
    console.log(`📊 Stage ${stageId} queue ends at: ${result.toISOString()}`)
    return result
  }

  console.log(`📊 Stage ${stageId} has empty queue, starting from: ${fromTime.toISOString()}`)
  return fromTime
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