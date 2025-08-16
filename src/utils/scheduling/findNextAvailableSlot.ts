import { SupabaseClient } from '@supabase/supabase-js';
import { addMinutes, differenceInMinutes, startOfDay, isBefore, max as dateMax, format } from 'date-fns';
import { 
  toSAST, 
  fromSAST, 
  getCurrentSAST, 
  isWorkingDay, 
  isWithinBusinessHours,
  getNextWorkingDayStart,
  createSASTTimeAsUTC
} from '../timezone';

/**
 * PRODUCTION-READY SCHEDULER: findNextAvailableSlot
 * - SAST-correct using existing timezone utilities
 * - Capacity-aware reading from stage_capacity_profiles
 * - Parallel packing finding gaps instead of linear appending
 * - Respects working hours and working days
 * - Batch-safe with in-memory allocation tracking
 * - Clear failure mode returning null instead of silent fallbacks
 */

const SAST_TZ = 'Africa/Johannesburg';

type AllocationKey = string; // `${stageId}|YYYY-MM-DD`
type Allocations = Map<AllocationKey, Array<{ start: Date; end: Date; minutes: number }>>;

/**
 * Convert a UTC ISO string from DB into a SAST Date object
 */
function dbUtcIsoToSASTDate(utcIso: string): Date {
  return toSAST(new Date(utcIso));
}

/**
 * Convert a SAST Date to UTC ISO string for DB storage
 */
function sastDateToDbUtcIso(sastDate: Date): string {
  return fromSAST(sastDate).toISOString();
}

/**
 * Format date to yyyy-MM-dd for allocation keys (based on SAST local date)
 */
function ymdKeyFor(date: Date): string {
  const d = startOfDay(date);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Helper to return next working day start (SAST) at given hour using UTC-first approach
 */
function nextWorkingDayStart(from: Date, startHour: number): Date {
  let cursor = new Date(from);
  cursor = addMinutes(cursor, 24 * 60); // Start from next day
  
  // Skip weekends
  while (cursor.getDay() === 0 || cursor.getDay() === 6) {
    cursor = addMinutes(cursor, 24 * 60);
  }
  
  // Create business start time at specified hour in SAST
  const dateStr = format(cursor, 'yyyy-MM-dd');
  const timeStr = `${startHour.toString().padStart(2, '0')}:00:00`;
  
  // Create SAST time using createSASTTimeAsUTC and convert back to SAST for consistency
  const utcTime = createSASTTimeAsUTC(dateStr, timeStr);
  return toSAST(utcTime);
}

/**
 * Build free intervals for a day (SAST) given existing allocations
 */
function buildFreeIntervalsForDay(
  dayStart: Date,
  dayEnd: Date,
  scheduledIntervals: Array<{ start: Date; end: Date }>
): Array<{ start: Date; end: Date }> {
  // normalize and sort existing intervals (clip to business window)
  const clipped = scheduledIntervals
    .map(({ start, end }) => ({
      start: dateMax([start, dayStart]),
      end: startOfIfBefore(end, dayEnd),
    }))
    .filter(({ start, end }) => start < end)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const free: Array<{ start: Date; end: Date }> = [];
  let cursor = new Date(dayStart);

  for (const intv of clipped) {
    if (cursor < intv.start) {
      free.push({ start: new Date(cursor), end: new Date(intv.start) });
    }
    cursor = dateMax([cursor, intv.end]);
  }
  if (cursor < dayEnd) free.push({ start: new Date(cursor), end: new Date(dayEnd) });
  return free;
}

/** small helper: if 'd' is after bound, return bound; otherwise return d */
function startOfIfBefore(d: Date, bound: Date): Date {
  return isBefore(d, bound) ? d : bound;
}

/**
 * API: findNextAvailableSlot
 * 
 * Returns SAST Date object representing start time, or null if no slot found within horizon
 * IMPORTANT: caller should convert result with sastDateToDbUtcIso(result) before saving to DB
 */
export async function findNextAvailableSlot(
  supabase: SupabaseClient,
  stageId: string,
  durationMinutes: number,
  opts?: {
    earliestUtcIso?: string; // earliest allowed time in UTC ISO (DB-style)
    workingHours?: { startHour: number; endHour: number }; // hours in local SAST
    horizonDays?: number;
    existingAllocations?: Allocations; // pass a Map to have batch reservations considered
  }
): Promise<Date | null> {
  const startHour = opts?.workingHours?.startHour ?? 8;
  const endHour = opts?.workingHours?.endHour ?? 17.5; // 17:30
  const horizon = opts?.horizonDays ?? 60;
  const allocations = opts?.existingAllocations ?? new Map<AllocationKey, Array<{ start: Date; end: Date; minutes: number }>>();

  // Determine earliest SAST cursor
  const earliestUtc = opts?.earliestUtcIso ? new Date(opts.earliestUtcIso) : new Date();
  let cursorSast = toSAST(earliestUtc);

  // If the earliest time is before business start today, clamp to start; if after business end, move to next working day start.
  function clampToBusinessWindow(d: Date): Date {
    // Create business window using UTC-first approach
    const dateStr = format(d, 'yyyy-MM-dd');
    
    // Create start and end times as SAST, convert to UTC, then back to SAST
    const startTimeStr = `${startHour.toString().padStart(2, '0')}:00:00`;
    const endMinutes = Math.floor((endHour % 1) * 60);
    const endTimeStr = `${Math.floor(endHour).toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}:00`;
    
    const dayStartUtc = fromSAST(new Date(`${dateStr}T${startTimeStr}`));
    const dayEndUtc = fromSAST(new Date(`${dateStr}T${endTimeStr}`));
    const dayStart = toSAST(dayStartUtc);
    const dayEnd = toSAST(dayEndUtc);

    if (d < dayStart) return dayStart;
    if (d >= dayEnd) return nextWorkingDayStart(d, startHour);
    return d;
  }

  cursorSast = clampToBusinessWindow(cursorSast);

  // Get stage capacity once
  const { data: capRows, error: capErr } = await supabase
    .from('stage_capacity_profiles')
    .select('daily_capacity_hours')
    .eq('production_stage_id', stageId)
    .limit(1)
    .maybeSingle();

  if (capErr) throw capErr;
  const dailyCapacityHours = capRows?.daily_capacity_hours ?? 8.5;
  const dailyCapacityMinutes = Math.round(dailyCapacityHours * 60);

  // iterate days up to horizon
  for (let dayOffset = 0; dayOffset < horizon; dayOffset++) {
    // compute the SAST date to check
    const checkDay = addMinutes(startOfDay(cursorSast), dayOffset * 24 * 60);
    // skip weekend
    if (checkDay.getDay() === 0 || checkDay.getDay() === 6) continue;

    // business window for this day (SAST) using UTC-first approach
    const dateStr = format(checkDay, 'yyyy-MM-dd');
    const startTimeStr = `${startHour.toString().padStart(2, '0')}:00:00`;
    const endMinutes = Math.floor((endHour % 1) * 60);
    const endTimeStr = `${Math.floor(endHour).toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}:00`;
    
    const dayStartUtc = fromSAST(new Date(`${dateStr}T${startTimeStr}`));
    const dayEndUtc = fromSAST(new Date(`${dateStr}T${endTimeStr}`));
    const dayStart = toSAST(dayStartUtc);
    const dayEnd = toSAST(dayEndUtc);

    // If dayStart is before our cursor (only on dayOffset === 0), ensure to use cursor
    const effectiveSearchStart = dayOffset === 0 ? dateMax([cursorSast, dayStart]) : dayStart;

    // Build DB query window: convert the SAST day window into UTC ISO for DB
    const dbDayStartUtcIso = fromSAST(dayStart).toISOString();
    const dbDayEndUtcIso = fromSAST(dayEnd).toISOString();

    // Query existing scheduled intervals for this stage that intersect the business window
    const { data: existingRows, error: existingError } = await supabase
      .from('job_stage_instances')
      .select('scheduled_start_at, scheduled_end_at, scheduled_minutes')
      .eq('production_stage_id', stageId)
      .not('scheduled_start_at', 'is', null)
      .gte('scheduled_start_at', dbDayStartUtcIso)
      .lt('scheduled_start_at', dbDayEndUtcIso);

    if (existingError) throw existingError;

    const dbIntervals: Array<{ start: Date; end: Date; minutes: number }> = (existingRows || []).map((r: any) => {
      const s = dbUtcIsoToSASTDate(r.scheduled_start_at);
      const e = dbUtcIsoToSASTDate(r.scheduled_end_at);
      const mins = r.scheduled_minutes ?? Math.max(1, Math.floor(differenceInMinutes(e, s)));
      return { start: s, end: e, minutes: mins };
    });

    // Merge with in-memory allocations for the same day
    const key = `${stageId}|${ymdKeyFor(dayStart)}`;
    const memIntervals = allocations.get(key) ?? [];

    const allIntervals = [...dbIntervals, ...memIntervals].sort((a, b) => a.start.getTime() - b.start.getTime());

    // Quick capacity guard (sum of minutes)
    const usedMinutes = allIntervals.reduce((s, it) => s + it.minutes, 0);
    if (usedMinutes + durationMinutes > dailyCapacityMinutes) {
      // Not enough total capacity today — skip to next day
      continue;
    }

    // Build free intervals and search for the earliest contiguous gap that fits durationMinutes
    const freeIntervals = buildFreeIntervalsForDay(dayStart, dayEnd, allIntervals);

    for (const free of freeIntervals) {
      const candidateStart = free.start < effectiveSearchStart ? effectiveSearchStart : free.start;
      const freeSpanMin = Math.floor(differenceInMinutes(free.end, candidateStart));
      if (freeSpanMin >= durationMinutes) {
        // We can place job at candidateStart
        const chosenStart = new Date(candidateStart);
        const chosenEnd = addMinutes(chosenStart, durationMinutes);

        // Register in allocations map for this day so subsequent calls see the reservation
        const arr = allocations.get(key) ?? [];
        arr.push({ start: chosenStart, end: chosenEnd, minutes: durationMinutes });
        allocations.set(key, arr);

        return chosenStart; // Return SAST Date
      }
    }
  }

  // No slot found within horizon
  return null;
}

export { sastDateToDbUtcIso, dbUtcIsoToSASTDate };