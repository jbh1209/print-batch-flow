import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'https://esm.sh/date-fns-tz@3.2.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SAST_TIMEZONE = 'Africa/Johannesburg'

/**
 * **SIMPLE SCHEDULER - DEPENDENCY-AWARE QUEUE SCHEDULING**
 * Implements the user's exact example logic:
 * 1. HP12000 and T250 run in parallel (Cover + Text)
 * 2. UV Varnishing waits for HP12000, then starts at UV queue end
 * 3. Hunkeler waits for T250, then starts at Hunkeler queue end  
 * 4. Gathering waits for BOTH UV and Hunkeler, then starts at Gathering queue end
 */

// **TIMEZONE UTILITIES: Proper SAST handling**
function getCurrentSAST(): Date {
  return toZonedTime(new Date(), SAST_TIMEZONE)
}

function toSAST(utcDate: Date): Date {
  return toZonedTime(utcDate, SAST_TIMEZONE)
}

function fromSAST(sastDate: Date): Date {
  return fromZonedTime(sastDate, SAST_TIMEZONE)
}

function formatSAST(date: Date, format: string = 'yyyy-MM-dd HH:mm:ss'): string {
  return formatInTimeZone(date, SAST_TIMEZONE, format)
}

// **BUSINESS HOURS: 8:00 AM - 5:30 PM SAST**
function isWithinBusinessHours(sastTime: Date): boolean {
  const hours = sastTime.getHours()
  const minutes = sastTime.getMinutes()
  const totalMinutes = hours * 60 + minutes
  return totalMinutes >= 480 && totalMinutes <= 1050 // 8 AM to 5:30 PM
}

function isWorkingDay(sastDate: Date): boolean {
  const dayOfWeek = sastDate.getDay()
  return dayOfWeek >= 1 && dayOfWeek <= 5 // Monday-Friday
}

function getNextWorkingDayAt8AM(fromDate: Date): Date {
  let nextDate = new Date(fromDate)
  nextDate.setDate(nextDate.getDate() + 1)
  
  // Skip weekends
  while (nextDate.getDay() === 0 || nextDate.getDay() === 6) {
    nextDate.setDate(nextDate.getDate() + 1)
  }
  
  // Set to 8:00 AM SAST
  nextDate.setHours(8, 0, 0, 0)
  return nextDate
}

function getNextValidBusinessTime(proposedTime: Date): Date {
  const nowSAST = getCurrentSAST()
  let adjustedTime = new Date(proposedTime)
  
  // If in the past, use current time
  if (adjustedTime < nowSAST) {
    adjustedTime = new Date(nowSAST)
  }
  
  // If outside business hours or not working day, move to next working day 8 AM
  if (!isWithinBusinessHours(adjustedTime) || !isWorkingDay(adjustedTime)) {
    return getNextWorkingDayAt8AM(adjustedTime)
  }
  
  return adjustedTime
}

interface SchedulingRequest {
  job_id: string
  job_table_name: string
  trigger_reason: 'manual' | 'job_approved' | 'admin_expedite' | 'nightly_reconciliation'
}

interface StageJob {
  stage_instance_id: string
  production_stage_id: string
  stage_name: string
  stage_order: number
  estimated_duration_minutes: number
  part_assignment?: string
  stage_group_id?: string
}

interface ScheduledStage {
  stage_instance_id: string
  production_stage_id: string
  stage_name: string
  start_time_sast: Date
  end_time_sast: Date
  duration_minutes: number
  part_assignment?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🚀 Simple Auto-Scheduler Starting')

    const body = await req.json()
    const { job_id, job_table_name = 'production_jobs', trigger_reason = 'manual' }: SchedulingRequest = body

    console.log(`📋 Processing job: ${job_id}, trigger: ${trigger_reason}`)

    // **RESET SCHEDULES ON MANUAL TRIGGER**
    if (trigger_reason === 'manual') {
      console.log('🧹 Manual trigger - clearing existing schedules')
      await clearAllExistingSchedules(supabase)
    }

    // **GET JOB STAGES (exclude DTP/Proof/Batch Allocation)**
    const stages = await getJobStageBreakdown(supabase, job_id, job_table_name)
    
    if (stages.length === 0) {
      console.log('⚠️ No stages to schedule')
      return new Response(
        JSON.stringify({ success: false, message: 'No stages to schedule' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📊 Found ${stages.length} stages to schedule:`)
    stages.forEach(s => console.log(`  - ${s.stage_name} (${s.part_assignment || 'both'}) - ${s.estimated_duration_minutes}min`))

    // **SIMPLE DEPENDENCY-AWARE SCHEDULING**
    const scheduledStages = await scheduleStagesWithDependencies(supabase, stages)
    
    console.log(`✅ Scheduled ${scheduledStages.length} stages`)

    // **UPDATE DATABASE**
    await updateJobStageInstances(supabase, scheduledStages)
    await createTimeSlotRecords(supabase, scheduledStages, job_id, job_table_name)

    console.log('🎉 Simple scheduling completed successfully')
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        scheduled_slots: scheduledStages.length,
        trigger_reason,
        schedule_reset: trigger_reason === 'manual'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Auto-scheduler error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// **CLEAR EXISTING SCHEDULES**
async function clearAllExistingSchedules(supabase: any): Promise<void> {
  // Clear stage_time_slots
  const { error: slotsError } = await supabase
    .from('stage_time_slots')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

  if (slotsError) console.error('Error clearing stage_time_slots:', slotsError)

  // Reset job_stage_instances scheduling fields
  const { error: instancesError } = await supabase
    .from('job_stage_instances')
    .update({
      auto_scheduled_start_at: null,
      auto_scheduled_end_at: null,
      auto_scheduled_duration_minutes: null,
      schedule_status: null
    })
    .neq('id', '00000000-0000-0000-0000-000000000000') // Update all

  if (instancesError) console.error('Error resetting job_stage_instances:', instancesError)
  
  console.log('✅ Cleared all existing schedules')
}

// **GET JOB STAGES**
async function getJobStageBreakdown(supabase: any, jobId: string, jobTableName: string): Promise<StageJob[]> {
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
        stage_group_id
      )
    `)
    .eq('job_id', jobId)
    .eq('job_table_name', jobTableName)
    .order('stage_order', { ascending: true })

  if (error) throw error

  // Filter out pre-production stages
  const productionStages = stages.filter(stage => {
    const stageName = stage.production_stages.name.toLowerCase()
    return !stageName.includes('dtp') && 
           !stageName.includes('proof') && 
           !stageName.includes('batch allocation')
  })

  return productionStages.map(stage => ({
    stage_instance_id: stage.id,
    production_stage_id: stage.production_stage_id,
    stage_name: stage.production_stages.name,
    stage_order: stage.stage_order,
    estimated_duration_minutes: stage.estimated_duration_minutes || 60,
    part_assignment: stage.part_assignment,
    stage_group_id: stage.production_stages.stage_group_id
  }))
}

// **SIMPLE DEPENDENCY-AWARE SCHEDULING LOGIC**
async function scheduleStagesWithDependencies(supabase: any, stages: StageJob[]): Promise<ScheduledStage[]> {
  const scheduledStages: ScheduledStage[] = []
  const stageEndTimes = new Map<string, Date>() // Track when each stage/part finishes
  
  // Current SAST time - never schedule in the past
  const nowSAST = getCurrentSAST()
  let currentSchedulingTime = getNextValidBusinessTime(nowSAST)
  
  console.log(`⏰ Starting scheduling from: ${formatSAST(currentSchedulingTime, 'yyyy-MM-dd HH:mm')}`)

  // **STAGE ORDER GROUPS - Process in dependency order**
  const stageGroups = new Map<number, StageJob[]>()
  for (const stage of stages) {
    if (!stageGroups.has(stage.stage_order)) {
      stageGroups.set(stage.stage_order, [])
    }
    stageGroups.get(stage.stage_order)!.push(stage)
  }

  const sortedOrders = Array.from(stageGroups.keys()).sort((a, b) => a - b)
  
  for (const order of sortedOrders) {
    const groupStages = stageGroups.get(order)!
    
    console.log(`\n📋 Scheduling stage group ${order} (${groupStages.length} stages)`)
    
    // **DEPENDENCY LOGIC: Wait for prerequisites**
    let groupStartTime = currentSchedulingTime
    
    // For stages that need to wait for previous stages to complete
    if (order > sortedOrders[0]) {
      // Find the latest end time from prerequisite stages
      const prerequisiteEndTimes: Date[] = []
      
      for (const stage of groupStages) {
        // Check if this stage depends on specific previous stages
        const dependencies = getDependenciesForStage(stage, stages)
        
        for (const dep of dependencies) {
          const depEndTime = stageEndTimes.get(dep)
          if (depEndTime) {
            prerequisiteEndTimes.push(depEndTime)
          }
        }
      }
      
      if (prerequisiteEndTimes.length > 0) {
        const latestPrerequisite = new Date(Math.max(...prerequisiteEndTimes.map(d => d.getTime())))
        groupStartTime = getNextValidBusinessTime(latestPrerequisite)
        console.log(`⏳ Group ${order} waiting for prerequisites, starting at: ${formatSAST(groupStartTime, 'HH:mm')}`)
      }
    }
    
    // **SCHEDULE EACH STAGE IN THE GROUP**
    for (const stage of groupStages) {
      const stageSchedule = await scheduleStageAtTime(supabase, stage, groupStartTime)
      scheduledStages.push(stageSchedule)
      
      // Track when this stage/part combination finishes
      const stagePartKey = `${stage.stage_name}:${stage.part_assignment || 'both'}`
      stageEndTimes.set(stagePartKey, stageSchedule.end_time_sast)
      
      console.log(`  ✅ ${stage.stage_name} (${stage.part_assignment || 'both'}): ${formatSAST(stageSchedule.start_time_sast, 'HH:mm')}-${formatSAST(stageSchedule.end_time_sast, 'HH:mm')}`)
    }
    
    // **UPDATE SCHEDULING TIME FOR NEXT GROUP**
    // Next group starts after this group completes (sequential processing)
    const groupEndTimes = groupStages.map(stage => {
      const stagePartKey = `${stage.stage_name}:${stage.part_assignment || 'both'}`
      return stageEndTimes.get(stagePartKey)!
    })
    const latestGroupEnd = new Date(Math.max(...groupEndTimes.map(d => d.getTime())))
    currentSchedulingTime = getNextValidBusinessTime(latestGroupEnd)
  }

  return scheduledStages
}

// **GET DEPENDENCIES FOR STAGE (USER'S EXAMPLE LOGIC)**
function getDependenciesForStage(stage: StageJob, allStages: StageJob[]): string[] {
  const stageName = stage.stage_name.toLowerCase()
  const part = stage.part_assignment
  
  // **UV Varnishing waits for HP12000 (Cover)**
  if (stageName.includes('uv') || stageName.includes('varnish')) {
    return ['HP12000:cover'] // Wait for HP12000 Cover to finish
  }
  
  // **Hunkeler waits for T250 (Text)**
  if (stageName.includes('hunkeler') || stageName.includes('trimming')) {
    return ['T250:text'] // Wait for T250 Text to finish
  }
  
  // **Gathering waits for BOTH Cover and Text paths to complete**
  if (stageName.includes('gather') || stageName.includes('collat')) {
    const dependencies: string[] = []
    
    // Find the last stage in Cover path
    const coverStages = allStages.filter(s => s.part_assignment === 'cover' || s.stage_name.includes('UV'))
    if (coverStages.length > 0) {
      const lastCoverStage = coverStages[coverStages.length - 1]
      dependencies.push(`${lastCoverStage.stage_name}:${lastCoverStage.part_assignment || 'cover'}`)
    }
    
    // Find the last stage in Text path  
    const textStages = allStages.filter(s => s.part_assignment === 'text' || s.stage_name.includes('Hunkeler'))
    if (textStages.length > 0) {
      const lastTextStage = textStages[textStages.length - 1]
      dependencies.push(`${lastTextStage.stage_name}:${lastTextStage.part_assignment || 'text'}`)
    }
    
    return dependencies
  }
  
  return [] // No dependencies for first stages (HP12000, T250)
}

// **SCHEDULE SINGLE STAGE AT SPECIFIC TIME**
async function scheduleStageAtTime(supabase: any, stage: StageJob, earliestStart: Date): Promise<ScheduledStage> {
  // **SIMPLE QUEUE LOGIC: Find when this stage's queue ends**
  const queueEndTime = await getStageQueueEndTime(supabase, stage.production_stage_id, earliestStart)
  
  // Schedule starts at queue end (or earliest start if queue is empty)
  const startTime = queueEndTime > earliestStart ? queueEndTime : earliestStart
  const validStartTime = getNextValidBusinessTime(startTime)
  
  // Calculate end time
  const endTime = new Date(validStartTime.getTime() + (stage.estimated_duration_minutes * 60 * 1000))
  
  // **JOB SPLITTING: If job exceeds working hours, split it**
  const { validatedStart, validatedEnd, actualDuration } = await validateBusinessHours(
    validStartTime, 
    endTime, 
    stage.estimated_duration_minutes
  )
  
  return {
    stage_instance_id: stage.stage_instance_id,
    production_stage_id: stage.production_stage_id,
    stage_name: stage.stage_name,
    start_time_sast: validatedStart,
    end_time_sast: validatedEnd,
    duration_minutes: actualDuration,
    part_assignment: stage.part_assignment
  }
}

// **GET STAGE QUEUE END TIME - SIMPLE SEQUENTIAL LOGIC**
async function getStageQueueEndTime(supabase: any, stageId: string, fromTime: Date): Promise<Date> {
  // Convert SAST to UTC for database query
  const fromTimeUTC = fromSAST(fromTime)
  
  const { data, error } = await supabase
    .from('stage_time_slots')
    .select('slot_end_time')
    .eq('production_stage_id', stageId)
    .gte('slot_start_time', fromTimeUTC.toISOString())
    .order('slot_end_time', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Error fetching queue end time:', error)
    return fromTime
  }

  if (data && data.length > 0) {
    const lastEndTimeUTC = new Date(data[0].slot_end_time)
    const lastEndTimeSAST = toSAST(lastEndTimeUTC)
    return lastEndTimeSAST > fromTime ? lastEndTimeSAST : fromTime
  }

  return fromTime // Empty queue
}

// **VALIDATE BUSINESS HOURS - SPLIT JOBS IF NEEDED**
async function validateBusinessHours(startTime: Date, endTime: Date, originalDuration: number): Promise<{
  validatedStart: Date,
  validatedEnd: Date,
  actualDuration: number
}> {
  // Check if end time exceeds 5:30 PM
  const endOfDay = new Date(startTime)
  endOfDay.setHours(17, 30, 0, 0) // 5:30 PM SAST
  
  if (endTime <= endOfDay) {
    // Fits within the day
    return {
      validatedStart: startTime,
      validatedEnd: endTime,
      actualDuration: originalDuration
    }
  }
  
  // **JOB SPLITTING: Job exceeds working hours**
  const availableMinutes = (endOfDay.getTime() - startTime.getTime()) / (1000 * 60)
  
  console.log(`✂️ Job splitting: ${originalDuration}min job, ${Math.floor(availableMinutes)}min available today`)
  
  // For now, just schedule the portion that fits (future enhancement: handle remainder)
  return {
    validatedStart: startTime,
    validatedEnd: endOfDay,
    actualDuration: Math.floor(availableMinutes)
  }
}

// **UPDATE DATABASE WITH SCHEDULE**
async function updateJobStageInstances(supabase: any, scheduledStages: ScheduledStage[]): Promise<void> {
  for (const stage of scheduledStages) {
    // Convert SAST to UTC for database storage
    const startUTC = fromSAST(stage.start_time_sast)
    const endUTC = fromSAST(stage.end_time_sast)
    
    const { error } = await supabase
      .from('job_stage_instances')
      .update({
        auto_scheduled_start_at: startUTC.toISOString(),
        auto_scheduled_end_at: endUTC.toISOString(),
        auto_scheduled_duration_minutes: stage.duration_minutes,
        schedule_status: 'scheduled'
      })
      .eq('id', stage.stage_instance_id)
    
    if (error) {
      console.error(`Error updating stage instance ${stage.stage_instance_id}:`, error)
    }
  }
}

// **CREATE TIME SLOT RECORDS FOR QUEUE TRACKING**
async function createTimeSlotRecords(supabase: any, scheduledStages: ScheduledStage[], jobId: string, jobTableName: string): Promise<void> {
  const timeSlotRecords = scheduledStages.map(stage => {
    // Convert SAST to UTC for database storage
    const startUTC = fromSAST(stage.start_time_sast)
    const endUTC = fromSAST(stage.end_time_sast)
    
    return {
      production_stage_id: stage.production_stage_id,
      date: formatSAST(stage.start_time_sast, 'yyyy-MM-dd'),
      slot_start_time: startUTC.toISOString(),
      slot_end_time: endUTC.toISOString(),
      duration_minutes: stage.duration_minutes,
      job_id: jobId,
      job_table_name: jobTableName,
      stage_instance_id: stage.stage_instance_id
    }
  })

  const { error } = await supabase
    .from('stage_time_slots')
    .insert(timeSlotRecords)
  
  if (error) {
    console.error('Error creating time slot records:', error)
  }
}