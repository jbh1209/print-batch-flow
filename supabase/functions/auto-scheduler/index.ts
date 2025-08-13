import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { formatInTimeZone } from 'https://esm.sh/date-fns-tz@3.2.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SAST_TIMEZONE = 'Africa/Johannesburg'

// Import centralized timezone utilities (simplified for edge function)
function toSAST(utcDate: Date): Date {
  return new Date(utcDate.getTime())
}

function fromSAST(sastDate: Date): Date {
  return new Date(sastDate.getTime())
}

function getCurrentSAST(): Date {
  const now = new Date()
  // Convert to SAST manually (UTC+2)
  return new Date(now.getTime() + (2 * 60 * 60 * 1000))
}

function getTomorrowAt8AM(): Date {
  const nowSAST = getCurrentSAST()
  const tomorrow = new Date(nowSAST)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  // Create proper SAST date for tomorrow at 8:00 AM
  const tomorrowDateStr = tomorrow.toISOString().split('T')[0]
  const tomorrowAt8AM = new Date(`${tomorrowDateStr}T08:00:00+02:00`)
  return tomorrowAt8AM
}

function createSASTDate(dateStr: string, timeStr: string): Date {
  const sastDateTime = new Date(`${dateStr}T${timeStr}+02:00`)
  return sastDateTime
}

interface SchedulingRequest {
  job_id: string
  job_table_name: string
  trigger_reason: 'manual' | 'job_approved' | 'admin_expedite' | 'nightly_reconciliation'
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
  duration_minutes?: number
  is_split?: boolean
  split_part?: number
  total_parts?: number
  remaining_duration_minutes?: number
}

// Core scheduling context - NEVER schedule in the past
interface SchedulingContext {
  currentTime: Date
  serverTime: Date
  timezone: string
}

function createSchedulingContext(): SchedulingContext {
  const currentSAST = getCurrentSAST()
  console.log(`🕐 Current SAST time: ${currentSAST.toISOString()} (SAST)`)
  
  return {
    currentTime: currentSAST,
    serverTime: currentSAST,
    timezone: SAST_TIMEZONE
  }
}

// **PHASE 0: SCHEDULE RESET FUNCTION**
async function clearAllSchedules(supabase: any): Promise<void> {
  console.log('🗑️ Clearing all stage_time_slots...')
  
  // Use a more reliable delete method - delete all rows
  const { error: slotsError, count: deletedSlots } = await supabase
    .from('stage_time_slots')
    .delete()
    .not('id', 'is', null) // This will match all rows since id is never null
  
  if (slotsError) {
    console.error('❌ Error clearing stage_time_slots:', slotsError)
    throw slotsError
  }
  
  console.log(`✅ Deleted ${deletedSlots || 0} existing time slots`)
  
  // Verify the table is actually empty
  const { data: remainingSlots, error: verifyError } = await supabase
    .from('stage_time_slots')
    .select('id')
    .limit(1)
  
  if (verifyError) {
    console.error('❌ Error verifying stage_time_slots deletion:', verifyError)
    throw verifyError
  }
  
  if (remainingSlots && remainingSlots.length > 0) {
    console.error('🚨 CRITICAL: stage_time_slots not fully cleared!')
    throw new Error('Failed to clear all stage_time_slots')
  }
  
  console.log('✅ Verified: stage_time_slots table is empty')

  console.log('🔄 Resetting auto-scheduled fields in job_stage_instances...')
  const { error: instancesError, count: updatedInstances } = await supabase
    .from('job_stage_instances')
    .update({
      auto_scheduled_start_at: null,
      auto_scheduled_end_at: null,
      auto_scheduled_duration_minutes: null,
      schedule_status: 'unscheduled'
    })
    .not('auto_scheduled_start_at', 'is', null)
  
  if (instancesError) {
    console.error('❌ Error resetting job_stage_instances:', instancesError)
    throw instancesError
  }
  
  console.log(`✅ Reset ${updatedInstances || 0} job stage instances`)
}

// **PHASE 1: WORKLOAD-AWARE SCHEDULING START TIME**
async function getSchedulingStartTime(supabase: any): Promise<Date> {
  const nowSAST = getCurrentSAST()
  
  // Check if we're within working hours today
  const todayWorkingHours = await getWorkingHours(supabase, nowSAST)
  if (todayWorkingHours && nowSAST < todayWorkingHours.end_time) {
    // We're still in today's working hours - find the latest queue end across all stages
    const latestQueueEnd = await getLatestQueueEndTimeAcrossAllStages(supabase, nowSAST)
    if (latestQueueEnd > nowSAST) {
      console.log(`📊 Latest queue ends at: ${latestQueueEnd.toISOString()}`)
      return latestQueueEnd
    }
    return nowSAST
  }
  
  // We're after working hours - start from next working day at 8 AM
  const nextWorkingDay = await getNextWorkingDay(supabase, nowSAST)
  if (nextWorkingDay) {
    // Check for existing workload on next working day
    const nextDayStart = nextWorkingDay.start_time
    const latestQueueEnd = await getLatestQueueEndTimeAcrossAllStages(supabase, nextDayStart)
    if (latestQueueEnd > nextDayStart) {
      console.log(`📊 Next working day queue ends at: ${latestQueueEnd.toISOString()}`)
      return latestQueueEnd
    }
    return nextDayStart
  }
  
  // Fallback to tomorrow 8 AM if no working day found
  const tomorrow = new Date(nowSAST)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowDateStr = tomorrow.toISOString().split('T')[0]
  return new Date(`${tomorrowDateStr}T08:00:00+02:00`)
}

// **PHASE 1: FIND LATEST QUEUE END ACROSS ALL STAGES**
async function getLatestQueueEndTimeAcrossAllStages(supabase: any, fromTime: Date): Promise<Date> {
  const fromTimeUTC = new Date(fromTime.getTime() - (2 * 60 * 60 * 1000))
  
  const { data } = await supabase
    .from('stage_time_slots')
    .select('slot_end_time')
    .gte('slot_start_time', fromTimeUTC.toISOString())
    .order('slot_end_time', { ascending: false })
    .limit(1)

  if (data && data.length > 0) {
    const lastEndTimeUTC = new Date(data[0].slot_end_time)
    const lastEndTimeSAST = new Date(lastEndTimeUTC.getTime() + (2 * 60 * 60 * 1000))
    return lastEndTimeSAST > fromTime ? lastEndTimeSAST : fromTime
  }

  return fromTime
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🚀 Auto-scheduler triggered')

    // Parse request body
    const body = await req.json()
    const { job_id, job_table_name = 'production_jobs', trigger_reason = 'manual' }: SchedulingRequest = body

    console.log(`📋 Processing job: ${job_id} from table: ${job_table_name}`)
    console.log(`🔧 Trigger reason: ${trigger_reason}`)

    // **PHASE 0: SCHEDULE RESET** - Clear corrupted schedule data on manual trigger
    if (trigger_reason === 'manual') {
      console.log('🧹 PHASE 0: Clearing all existing schedules for clean slate...')
      await clearAllSchedules(supabase)
      console.log('✨ Schedule reset complete - starting fresh')
    }

    // Create scheduling context
    const context = createSchedulingContext()
    
    // Get job stage breakdown (excludes DTP and Proof stages)
    const stages = await getJobStageBreakdown(supabase, job_id, job_table_name)
    
    if (stages.length === 0) {
      console.log('⚠️ No valid stages found for scheduling')
      return new Response(
        JSON.stringify({ success: false, message: 'No stages to schedule' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📊 Found ${stages.length} stages to schedule`)

    // **PHASE 1: WORKLOAD-AWARE SCHEDULING**
    // Schedule stages in order, respecting existing workload and dependencies
    const scheduledSlots = await scheduleStagesInOrder(supabase, stages, context)
    
    console.log(`✅ Scheduled ${scheduledSlots.length} time slots`)

    // Update job stage instances with calculated times
    await updateStageInstancesWithSchedule(supabase, scheduledSlots, job_id, job_table_name)
    
    // Create time slot records for queue tracking
    await createTimeSlotRecords(supabase, scheduledSlots, job_id, job_table_name)

    console.log('🎉 Auto-scheduling completed successfully')
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        scheduled_slots: scheduledSlots.length,
        trigger_reason,
        schedule_reset: trigger_reason === 'manual',
        context 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Auto-scheduler error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
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

// **PHASE 1: WORKLOAD-AWARE STAGE SCHEDULING**
async function scheduleStagesInOrder(supabase: any, stages: StageSchedule[], context: SchedulingContext): Promise<(StageSchedule & TimeSlot)[]> {
  const scheduledSlots: (StageSchedule & TimeSlot)[] = []
  let earliestStart = await getSchedulingStartTime(supabase)
  
  console.log(`📅 Starting scheduling from: ${earliestStart.toISOString()}`)

  // Group stages by order for parallel processing
  const stageGroups = new Map<number, StageSchedule[]>()
  
  for (const stage of stages) {
    if (!stageGroups.has(stage.stage_order)) {
      stageGroups.set(stage.stage_order, [])
    }
    stageGroups.get(stage.stage_order)!.push(stage)
  }

  // Process each group in order
  const sortedOrders = Array.from(stageGroups.keys()).sort((a, b) => a - b)
  
  for (const order of sortedOrders) {
    const groupStages = stageGroups.get(order)!
    
    console.log(`🔄 Scheduling stage group ${order} with ${groupStages.length} stages`)
    
    const groupSlots = await scheduleParallelGroup(supabase, groupStages, earliestStart, context)
    scheduledSlots.push(...groupSlots)
    
    // Update earliest start to be after this group completes
    const groupEndTime = Math.max(...groupSlots.map(slot => slot.end_time.getTime()))
    earliestStart = new Date(groupEndTime)
    
    console.log(`✅ Group ${order} scheduled, next group starts: ${earliestStart.toISOString()}`)
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

// **PHASE 3: TETRIS LOGIC - FIND NEXT AVAILABLE SLOT WITH GAP FILLING**
async function findNextAvailableSlot(supabase: any, stageId: string, durationMinutes: number, earliestStart: Date, context: SchedulingContext): Promise<TimeSlot> {
  console.log(`🔍 Finding slot for stage ${stageId}, duration: ${durationMinutes}min, from: ${earliestStart.toISOString()}`)
  
  // **PHASE 3: Check for gaps in schedule first**
  const gapSlot = await findGapInSchedule(supabase, stageId, durationMinutes, earliestStart)
  if (gapSlot) {
    console.log(`🎯 Found gap: ${gapSlot.start_time.toISOString()} to ${gapSlot.end_time.toISOString()}`)
    return gapSlot
  }
  
  // No gap found - get current queue end time for this stage
  const queueEndTime = await getCurrentQueueEndTime(supabase, stageId, earliestStart)
  
  // Proposed start time is the later of earliestStart or queue end
  const proposedStart = queueEndTime > earliestStart ? queueEndTime : earliestStart
  
  console.log(`💭 Proposed start time: ${proposedStart.toISOString()}`)
  
  // Ensure proposed time is within working hours
  const adjustedStart = await ensureWithinWorkingHours(supabase, proposedStart, null)
  
  console.log(`⏰ Adjusted start time: ${adjustedStart.toISOString()}`)
  
  // Calculate end time
  const proposedEnd = new Date(adjustedStart.getTime() + (durationMinutes * 60 * 1000))
  
  // **PHASE 2: Validate and handle job splitting if needed**
  const validatedSlot = await validateWorkingHoursSlot(supabase, adjustedStart, proposedEnd, durationMinutes)
  
  console.log(`✅ Final slot: ${validatedSlot.start_time.toISOString()} to ${validatedSlot.end_time.toISOString()}`)
  
  return validatedSlot
}

// **PHASE 3: GAP DETECTION ALGORITHM**
async function findGapInSchedule(supabase: any, stageId: string, durationMinutes: number, earliestStart: Date): Promise<TimeSlot | null> {
  const fromTimeUTC = new Date(earliestStart.getTime() - (2 * 60 * 60 * 1000))
  
  // Get all existing slots for this stage, ordered by start time
  const { data: existingSlots } = await supabase
    .from('stage_time_slots')
    .select('slot_start_time, slot_end_time')
    .eq('production_stage_id', stageId)
    .gte('slot_start_time', fromTimeUTC.toISOString())
    .order('slot_start_time', { ascending: true })

  if (!existingSlots || existingSlots.length === 0) {
    return null // No existing slots, no gaps to fill
  }

  // Convert to SAST and look for gaps
  let currentTime = earliestStart
  
  for (const slot of existingSlots) {
    const slotStartSAST = new Date(new Date(slot.slot_start_time).getTime() + (2 * 60 * 60 * 1000))
    const slotEndSAST = new Date(new Date(slot.slot_end_time).getTime() + (2 * 60 * 60 * 1000))
    
    // Check if there's a gap between currentTime and this slot's start
    const gapDuration = (slotStartSAST.getTime() - currentTime.getTime()) / (1000 * 60)
    
    if (gapDuration >= durationMinutes) {
      // Found a gap! Validate it's within working hours
      const gapEnd = new Date(currentTime.getTime() + (durationMinutes * 60 * 1000))
      const workingHours = await getWorkingHours(supabase, currentTime)
      
      if (workingHours && currentTime >= workingHours.start_time && gapEnd <= workingHours.end_time) {
        return {
          start_time: currentTime,
          end_time: gapEnd,
          duration_minutes: durationMinutes,
          is_split: false
        }
      }
    }
    
    // Move to the end of this slot
    currentTime = slotEndSAST
  }
  
  return null // No suitable gap found
}

// Ensure start time is within working hours
async function ensureWithinWorkingHours(supabase: any, proposedStart: Date, workingHours: any): Promise<Date> {
  if (!workingHours) {
    workingHours = await getWorkingHours(supabase, proposedStart)
  }
  
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

// **PHASE 2: VALIDATE AND SPLIT JOBS IF NEEDED**
async function validateWorkingHoursSlot(supabase: any, startTime: Date, endTime: Date, durationMinutes: number): Promise<TimeSlot> {
  console.log(`🕐 Validating slot: ${startTime.toISOString()} to ${endTime.toISOString()}`)
  
  const workingHours = await getWorkingHours(supabase, startTime)
  
  if (!workingHours || !workingHours.is_working_day) {
    console.log('📅 Not a working day, moving to next working day')
    const nextWorkingDay = await getNextWorkingDay(supabase, startTime)
    if (nextWorkingDay) {
      const newEndTime = new Date(nextWorkingDay.start_time.getTime() + (durationMinutes * 60 * 1000))
      return {
        start_time: nextWorkingDay.start_time,
        end_time: newEndTime,
        duration_minutes: durationMinutes,
        is_split: false
      }
    }
  }
  
  // Check if the slot fits within the working day
  if (endTime <= workingHours.end_time) {
    // Fits perfectly
    return {
      start_time: startTime,
      end_time: endTime,
      duration_minutes: durationMinutes,
      is_split: false
    }
  }
  
  // **PHASE 2: JOB SPLITTING LOGIC**
  console.log('✂️ Job extends beyond working hours, splitting job')
  
  // Calculate how much time we have left in this working day
  const availableMinutes = (workingHours.end_time.getTime() - startTime.getTime()) / (1000 * 60)
  const remainingMinutes = durationMinutes - availableMinutes
  
  console.log(`📊 Available: ${availableMinutes}min, Remaining: ${remainingMinutes}min`)
  
  // For now, return the first part - the remaining part will be handled by 
  // recursive scheduling in future iterations
  return {
    start_time: startTime,
    end_time: workingHours.end_time,
    duration_minutes: Math.floor(availableMinutes),
    is_split: true,
    split_part: 1,
    total_parts: 2,
    remaining_duration_minutes: remainingMinutes
  }
}

// Get working hours for a specific date (SAST-aware)
async function getWorkingHours(supabase: any, date: Date) {
  // Use SAST day of week calculation
  const sastDate = getCurrentSAST()
  const dayOfWeek = sastDate.getDay() // 0=Sunday, 1=Monday, etc
  
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

  // Create SAST working hours for the given date
  const dateStr = date.toISOString().split('T')[0]
  const startTime = new Date(`${dateStr}T${data.shift_start_time}+02:00`)
  const endTime = new Date(`${dateStr}T${data.shift_end_time}+02:00`)

  return {
    start_time: startTime,
    end_time: endTime,
    is_working_day: true
  }
}

// Get next working day (SAST-aware)
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
  // Convert fromTime to UTC for database query (SAST is UTC+2)
  const fromTimeUTC = new Date(fromTime.getTime() - (2 * 60 * 60 * 1000))
  
  const { data } = await supabase
    .from('stage_time_slots')
    .select('slot_end_time')
    .eq('production_stage_id', stageId)
    .gte('slot_start_time', fromTimeUTC.toISOString())
    .order('slot_end_time', { ascending: false })
    .limit(1)

  if (data && data.length > 0) {
    const lastEndTimeUTC = new Date(data[0].slot_end_time)
    // Convert back to SAST (add 2 hours)
    const lastEndTimeSAST = new Date(lastEndTimeUTC.getTime() + (2 * 60 * 60 * 1000))
    const result = lastEndTimeSAST > fromTime ? lastEndTimeSAST : fromTime
    console.log(`📊 Stage ${stageId} queue ends at: ${result.toISOString()}`)
    return result
  }

  // No existing slots - return the fromTime
  console.log(`📊 Stage ${stageId} has empty queue, starting from: ${fromTime.toISOString()}`)
  return fromTime
}

// Update job_stage_instances with scheduled times
async function updateStageInstancesWithSchedule(supabase: any, scheduledSlots: (StageSchedule & TimeSlot)[], jobId: string, jobTableName: string) {
  for (const slot of scheduledSlots) {
    // Convert SAST times to UTC for database storage
    const startUTC = new Date(slot.start_time.getTime() - (2 * 60 * 60 * 1000))
    const endUTC = new Date(slot.end_time.getTime() - (2 * 60 * 60 * 1000))
    
    await supabase
      .from('job_stage_instances')
      .update({
        auto_scheduled_start_at: startUTC.toISOString(),
        auto_scheduled_end_at: endUTC.toISOString(),
        auto_scheduled_duration_minutes: slot.duration_minutes || 0,
        is_split_job: slot.is_split || false,
        split_job_part: slot.split_part || 1,
        split_job_total_parts: slot.total_parts || 1,
        schedule_status: 'scheduled'
      })
      .eq('id', slot.stage_instance_id)
  }
}

// Create time slot records for queue tracking
async function createTimeSlotRecords(supabase: any, scheduledSlots: (StageSchedule & TimeSlot)[], jobId: string, jobTableName: string) {
  const timeSlotRecords = scheduledSlots.map(slot => {
    // Convert SAST times to UTC for database storage
    const startUTC = new Date(slot.start_time.getTime() - (2 * 60 * 60 * 1000))
    const endUTC = new Date(slot.end_time.getTime() - (2 * 60 * 60 * 1000))
    
    return {
      production_stage_id: slot.production_stage_id,
      date: startUTC.toISOString().split('T')[0], // Use UTC date for storage
      slot_start_time: startUTC.toISOString(),
      slot_end_time: endUTC.toISOString(),
      duration_minutes: slot.duration_minutes || 0,
      job_id: jobId,
      job_table_name: jobTableName,
      stage_instance_id: slot.stage_instance_id
    }
  })

  await supabase
    .from('stage_time_slots')
    .insert(timeSlotRecords)
}