import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// ===== CLEAN SCHEDULER TYPES (ADAPTED FROM USER'S DESIGN) =====

export type StageType = string; // Flexible to match your stage names

export interface StageInput {
  stageId: string;            // job_stage_instances.id 
  type: string;               // production_stages.name
  durationMinutes: number;    // estimated_duration_minutes
  resourceId: string;         // production_stage_id (resource/queue identifier)
  order: number;              // stage_order for dependency chain
}

export interface OrderInput {
  orderId: string;            // job_id
  stages: StageInput[];
  earliestStart?: Date;
  priority?: number;
}

export interface WorkingHours {
  startMinutesFromMidnight: number;   // 8*60 = 480 for 08:00
  endMinutesFromMidnight: number;     // 16*60+30 = 990 for 16:30  
  workingWeekdays: number[];          // [1,2,3,4,5] Mon-Fri
}

export interface ScheduledStage {
  stageId: string;
  orderId: string;
  type: string;
  resourceId: string;
  start: Date;
  end: Date;
}

export interface ScheduleResult {
  stages: ScheduledStage[];
  resourceNextAvailable: Record<string, Date>;
}

// Default working hours: Mon–Fri 08:00–16:30
const DEFAULT_HOURS: WorkingHours = {
  startMinutesFromMidnight: 8 * 60,      // 08:00
  endMinutesFromMidnight: 16 * 60 + 30,  // 16:30
  workingWeekdays: [1, 2, 3, 4, 5],      // Mon-Fri
};

// ===== TIME UTILITIES (NO DEPENDENCIES - CLEAN) =====

function minutesFromMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function setMinutesFromMidnight(d: Date, minutes: number): Date {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const copy = new Date(d);
  copy.setHours(h, m, 0, 0);
  return copy;
}

function isWorkingDay(d: Date, hrs: WorkingHours): boolean {
  const wd = d.getDay(); // 0..6 (Sun..Sat)
  const weekday = wd === 0 ? 7 : wd; // Convert to 1..7 with Monday=1
  return hrs.workingWeekdays.includes(weekday);
}

function clampToWorkStart(d: Date, hrs: WorkingHours): Date {
  if (!isWorkingDay(d, hrs)) {
    const next = nextWorkingDay(d, hrs);
    return setMinutesFromMidnight(next, hrs.startMinutesFromMidnight);
  }
  const mins = minutesFromMidnight(d);
  if (mins < hrs.startMinutesFromMidnight) {
    return setMinutesFromMidnight(d, hrs.startMinutesFromMidnight);
  }
  if (mins >= hrs.endMinutesFromMidnight) {
    const next = nextWorkingDay(d, hrs);
    return setMinutesFromMidnight(next, hrs.startMinutesFromMidnight);
  }
  return d;
}

function nextWorkingDay(d: Date, hrs: WorkingHours): Date {
  let cur = new Date(d);
  cur.setDate(cur.getDate() + 1);
  cur.setHours(0, 0, 0, 0);
  while (!isWorkingDay(cur, hrs)) {
    cur.setDate(cur.getDate() + 1);
  }
  return cur;
}

function addWorkingMinutes(start: Date, minutes: number, hrs: WorkingHours): Date {
  let cursor = clampToWorkStart(start, hrs);
  let remaining = minutes;

  while (remaining > 0) {
    const mins = minutesFromMidnight(cursor);
    const available = hrs.endMinutesFromMidnight - mins;
    
    if (remaining <= available) {
      cursor = new Date(cursor.getTime() + remaining * 60_000);
      remaining = 0;
    } else {
      cursor = new Date(cursor.getTime() + available * 60_000);
      remaining -= available;
      const next = nextWorkingDay(cursor, hrs);
      cursor = setMinutesFromMidnight(next, hrs.startMinutesFromMidnight);
    }
  }
  return cursor;
}

// ===== CORE SCHEDULER (ADAPTED FROM USER'S DESIGN) =====

function scheduleOrders(
  orders: OrderInput[],
  hours: WorkingHours,
  initialResourceNextAvailable: Record<string, Date> = {}
): ScheduleResult {
  const resourceNext: Record<string, Date> = { ...initialResourceNextAvailable };
  const out: ScheduledStage[] = [];

  // Sort orders by priority and earliest start
  const enriched = orders.map((o, idx) => ({
    ...o,
    idx,
    earliestStart: o.earliestStart ?? new Date(),
    priority: o.priority ?? 1000,
  }));
  
  enriched.sort((a, b) => {
    const t = a.earliestStart.getTime() - b.earliestStart.getTime();
    if (t !== 0) return t;
    const p = a.priority - b.priority;
    if (p !== 0) return p;
    return a.idx - b.idx;
  });

  for (const order of enriched) {
    // Sort stages by order for sequential dependency
    const sortedStages = [...order.stages].sort((a, b) => a.order - b.order);
    
    let prevEndForJob: Date = clampToWorkStart(order.earliestStart, hours);

    for (const stage of sortedStages) {
      const qTail = resourceNext[stage.resourceId];
      const candidateStart = clampToWorkStart(
        new Date(Math.max(prevEndForJob.getTime(), qTail?.getTime() ?? 0)),
        hours
      );
      
      const end = addWorkingMinutes(candidateStart, stage.durationMinutes, hours);

      out.push({
        stageId: stage.stageId,
        orderId: order.orderId,
        type: stage.type,
        resourceId: stage.resourceId,
        start: candidateStart,
        end,
      });

      prevEndForJob = end;
      resourceNext[stage.resourceId] = end;
    }
  }

  return { stages: out, resourceNextAvailable: resourceNext };
}

// ===== EDGE FUNCTION HANDLER =====

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { job_id, job_table_name = 'production_jobs', trigger_reason } = await req.json()
    console.log(`🚀 **CLEAN SCHEDULER START** - Job: ${job_id}, Reason: ${trigger_reason}`)

    // STEP 1: Load existing scheduled work to seed queue tails
    const { data: existingWork } = await supabase
      .from('job_stage_instances')
      .select('production_stage_id, auto_scheduled_start_at, auto_scheduled_end_at, scheduled_start_at, scheduled_end_at')
      .in('status', ['pending', 'active', 'completed'])
      .not('auto_scheduled_start_at', 'is', null)
      .not('auto_scheduled_end_at', 'is', null);

    // Build resource queue tails
    const resourceTails: Record<string, Date> = {};
    for (const work of existingWork || []) {
      const start = work.auto_scheduled_start_at || work.scheduled_start_at;
      const end = work.auto_scheduled_end_at || work.scheduled_end_at;
      if (start && end) {
        const endDate = new Date(end);
        const current = resourceTails[work.production_stage_id]?.getTime() ?? 0;
        if (endDate.getTime() > current) {
          resourceTails[work.production_stage_id] = endDate;
        }
      }
    }

    console.log(`📊 Loaded ${Object.keys(resourceTails).length} resource queue tails`)

    // STEP 2: Get job's schedulable stages
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
        message: 'No schedulable stages found',
        scheduled_slots: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`📋 Found ${jobStages.length} schedulable stages`)

    // STEP 3: Build order input for scheduler
    const order: OrderInput = {
      orderId: job_id,
      earliestStart: new Date(),
      priority: 1,
      stages: jobStages.map(stage => ({
        stageId: stage.id,
        type: stage.production_stages?.name || 'Unknown',
        durationMinutes: stage.estimated_duration_minutes || 120,
        resourceId: stage.production_stage_id,
        order: stage.stage_order
      }))
    };

    // STEP 4: Run the clean scheduler
    const result = scheduleOrders([order], DEFAULT_HOURS, resourceTails);

    console.log(`✅ Scheduled ${result.stages.length} stages`)

    // STEP 5: Update database with results
    let updateCount = 0;
    for (const stage of result.stages) {
      const { error: updateError } = await supabase
        .from('job_stage_instances')
        .update({
          auto_scheduled_start_at: stage.start.toISOString(),
          auto_scheduled_end_at: stage.end.toISOString(),
          auto_scheduled_duration_minutes: 
            Math.round((stage.end.getTime() - stage.start.getTime()) / 60000),
          schedule_status: 'auto_scheduled',
          updated_at: new Date().toISOString()
        })
        .eq('id', stage.stageId);

      if (updateError) {
        console.error(`❌ Failed to update stage ${stage.stageId}:`, updateError);
      } else {
        updateCount++;
        console.log(`✅ Updated ${stage.type}: ${stage.start.toISOString().split('T')[1].substring(0,5)} - ${stage.end.toISOString().split('T')[1].substring(0,5)}`);
      }
    }

    console.log(`🎯 **CLEAN SCHEDULER COMPLETE** - Updated ${updateCount}/${result.stages.length} stages`)

    return new Response(JSON.stringify({
      success: true,
      message: `Scheduled ${result.stages.length} stages using clean scheduler`,
      scheduled_slots: result.stages.length,
      slots: result.stages.map(s => ({
        stage_id: s.stageId,
        start: s.start.toISOString(),
        end: s.end.toISOString()
      }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Clean scheduler error:', error)
    
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown scheduling error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
