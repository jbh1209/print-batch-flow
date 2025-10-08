# Scheduler System Change Log

**COMPLETE VERSION HISTORY**

This document tracks all changes to the scheduler system in chronological order, providing a complete audit trail.

---

## Version History

### Current Version: 2.4 - Enhanced Gap-Filling with Dynamic Lookback
**Date**: October 7, 2025  
**Status**: ✅ WORKING - PRODUCTION

---

## Detailed Change Log

### October 7, 2025 - Enhanced Gap-Filling Regression Fix (v2.4)

**Migration**: `20251007180644_4664bf1f-28d6-42b4-abf8-dcb5beffa0ab.sql`

#### Problem Identified
- Gap-filling was broken after recent 30-day caps were introduced
- Finishing stages with large gaps (e.g., 49 days) couldn't move forward
- Jobs due months out (like D426432 in December) were being scheduled far in the future
- Recent lookback and move cap additions created artificial constraints

#### Root Cause
- Hard-coded `v_lookback_days` capped at 30 days prevented scanning back to predecessor stages
- Hard-coded `v_stage_move_cap` of 30 days prevented legitimate gap-fills for finishing stages
- `find_available_gaps()` scan window didn't include `earliest_possible_start` date

#### Solution Implemented

**1. Dynamic Lookback Calculation**
```sql
-- Calculate based on gap to previous stage
v_days_back_to_prev := EXTRACT(epoch FROM (original_start - earliest_possible_start)) / 86400.0;
v_lookback_days := LEAST(90, GREATEST(7, FLOOR(v_days_back_to_prev)))::integer;
```

**2. Removed Upper Move Cap for Gap-Filling Stages**
```sql
-- BEFORE: days_saved <= 30 days (artificial limit)
-- AFTER: Only minimum threshold (0.25 days), no upper limit for allow_gap_filling=true
IF best_gap IS NOT NULL AND days_saved >= 0.25 THEN
```

**3. Extended find_available_gaps() Scan Window**
```sql
scan_start_date := GREATEST(
  (p_fifo_start_time - make_interval(days => p_lookback_days))::date,
  v_earliest_allowed_date,
  COALESCE(p_align_at::date, v_earliest_allowed_date)
);
```

#### Behavior Changes

| Scenario | Before (v2.3) | After (v2.4) |
|----------|---------------|--------------|
| Finishing stage 49 days out | Couldn't move (>30 day cap) | Can move to fill gap ✓ |
| Lookback window | Fixed 30 days max | Dynamic up to 90 days ✓ |
| Scan window | Might miss predecessor date | Always includes predecessor ✓ |
| Move threshold | 0.25 days minimum | 0.25 days minimum (unchanged) |

#### Files Changed
1. Migration: `20251007180644_4664bf1f-28d6-42b4-abf8-dcb5beffa0ab.sql`
2. Function: `find_available_gaps()` - Extended scan window calculation
3. Function: `scheduler_reschedule_all_parallel_aware()` - Dynamic lookback, removed cap

#### Impact
- ✅ Finishing stages can now be gap-filled regardless of distance
- ✅ Lookback dynamically calculated based on actual job spacing
- ✅ Maximum efficiency for production schedule packing
- ✅ Precedence constraints still enforced (no violations)
- ✅ Backward compatible with v2.3

---

### October 3, 2025 - Tight Packing with Alignment (v2.3)

**Migration**: `20251003112533` and `20251003114331`

#### Problem Identified
- Gap-filling was working but stages were starting at gap beginnings even when predecessors finished mid-gap
- Created unnecessary delays between dependent stages
- Result: Sub-optimal packing with wasted time between sequential stages

#### Root Cause
- `find_available_gaps()` only considered gap start time, not predecessor finish times
- No mechanism to align stage start with `earliest_possible_start`
- Threshold was 1 day (too coarse for fine-grained optimization)

#### Solution Implemented

**1. Added `p_align_at` parameter to `find_available_gaps()`**
```sql
-- BEFORE
CREATE FUNCTION find_available_gaps(
  p_stage_id uuid,
  p_minutes_needed int,
  p_original_start timestamptz,
  p_lookback_days int
)

-- AFTER
CREATE FUNCTION find_available_gaps(
  p_stage_id uuid,
  p_minutes_needed int,
  p_original_start timestamptz,
  p_lookback_days int,
  p_align_at timestamptz DEFAULT NULL  -- NEW: Precision alignment
)
```

**2. Updated gap search logic for precise alignment**
```sql
-- Now uses: GREATEST(gap_start, p_align_at, now())
-- This ensures stage starts exactly when predecessor finishes (if mid-gap)
```

**3. Reduced threshold to 6 hours (0.25 days)**
```sql
-- BEFORE: 1 day minimum savings
IF (original_start - best_candidate_start) >= interval '1 day' THEN

-- AFTER: 6 hours minimum savings (finer granularity)
IF (original_start - best_candidate_start) >= interval '6 hours' THEN
```

**4. Updated both schedulers to pass `earliest_possible_start`**
- `scheduler_reschedule_all_parallel_aware()` - Phase 2 gap-filling pass
- `scheduler_append_jobs()` - Append mode gap-filling

#### Behavior Changes

**Before (v2.2):**
- Predecessor finishes: 10:30 AM
- Gap available: 8:00 AM - 12:00 PM
- Stage placed at: 8:00 AM ❌ (1.5 hours wasted waiting for predecessor)

**After (v2.3):**
- Predecessor finishes: 10:30 AM  
- Gap available: 8:00 AM - 12:00 PM
- Stage placed at: 10:30 AM ✓ (zero-gap packing)

#### Files Changed
1. `supabase/migrations/20251003112533` - Added `p_align_at` parameter
2. `supabase/migrations/20251003114331` - Updated both scheduler functions
3. Function: `find_available_gaps()` - Enhanced gap detection
4. Function: `scheduler_reschedule_all_parallel_aware()` - Pass alignment time
5. Function: `scheduler_append_jobs()` - Pass alignment time

#### Verification
```sql
-- Test tight packing for D426225
SELECT 
  jsi.id,
  ps.name as stage,
  jsi.scheduled_start_at,
  jsi.scheduled_end_at,
  LAG(jsi.scheduled_end_at) OVER (ORDER BY jsi.stage_order) as prev_end,
  jsi.scheduled_start_at - LAG(jsi.scheduled_end_at) OVER (ORDER BY jsi.stage_order) as gap
FROM job_stage_instances jsi
JOIN production_stages ps ON ps.id = jsi.production_stage_id
JOIN production_jobs pj ON pj.id = jsi.job_id
WHERE pj.wo_no = 'D426225'
  AND jsi.schedule_status = 'scheduled'
ORDER BY jsi.stage_order;

-- Expected: All gaps = '00:00:00' (zero gaps between stages)
```

#### Impact
- ✅ Zero-gap scheduling for sequential stages
- ✅ Tighter schedule packing (more work per day)
- ✅ 6-hour threshold enables fine-grained optimization
- ✅ No performance impact (same algorithm complexity)
- ✅ Backward compatible with v2.2

---

### October 2, 2025 - Gap-Filling Optimization (v2.2)

**Migration**: `20251002163603` (reschedule_all) and `20251002165724` (append_jobs)

#### Problem Identified
- FIFO scheduling left gaps in production stage schedules
- Short stages could fit in gaps but weren't being considered
- Result: Suboptimal resource utilization and longer overall timelines

#### Root Cause
- Single-pass FIFO algorithm had no backtracking
- No mechanism to scan backward for gap-filling opportunities
- No audit trail of gap-filling decisions

#### Solution Implemented

**1. Two-Phase Scheduling Algorithm**
```
Phase 1: FIFO Sequential Scheduling (existing)
  └─ Schedule all jobs in proof approval order

Phase 2: Gap-Filling Optimization Pass (NEW)
  └─ Scan backward to fill scheduling gaps with smaller jobs
```

**2. Created `schedule_gap_fills` Audit Table**
```sql
CREATE TABLE schedule_gap_fills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  stage_instance_id uuid NOT NULL,
  production_stage_id uuid NOT NULL,
  original_start_at timestamptz NOT NULL,
  new_start_at timestamptz NOT NULL,
  minutes_saved numeric NOT NULL,
  fill_reason text,
  created_at timestamptz DEFAULT now()
);
```

**3. Added `allow_gap_filling` Column to `production_stages`**
```sql
ALTER TABLE production_stages 
ADD COLUMN allow_gap_filling boolean DEFAULT true;
```

**4. Stage-Type-Aware Movement Caps**
```sql
-- Finishing stages (trimming, packaging, dispatch): 30 days max
-- Standard stages: 21 days max
```

**5. Dynamic Lookback Calculation**
```sql
-- For standard stages:
lookback_days := MIN(30, MAX(7, FLOOR(days_until_original * 0.7)))

-- For finishing stages:
lookback_days := MIN(30, MAX(7, FLOOR(days_until_original)))
```

#### Gap-Filling Eligibility Criteria
1. Stage duration ≤ 120 minutes (2 hours)
2. `allow_gap_filling = true` on production_stage
3. Stage status = 'scheduled' (not completed/active)
4. Minimum 1 day savings required (v2.2) → Changed to 6 hours (v2.3)
5. Respects stage-type movement caps
6. Respects job-level dependencies (predecessors)

#### Behavior Changes

| Scenario | Before (v2.1) | After (v2.2) |
|----------|---------------|--------------|
| Short stage (60 min) | Scheduled in FIFO order | May move earlier into gap |
| Long stage (180 min) | Scheduled in FIFO order | Never moved (>120 min limit) |
| Finishing stage | 21-day movement cap | 30-day movement cap |
| Gap detection | None | Backward scan with lookback |

#### Files Changed
1. `supabase/migrations/20251002163603` - Updated `scheduler_reschedule_all_parallel_aware()`
2. `supabase/migrations/20251002165724` - Updated `scheduler_append_jobs()`
3. Added: `schedule_gap_fills` table for audit logging
4. Added: `allow_gap_filling` column to `production_stages`
5. Function: `find_available_gaps()` - New helper for gap detection

#### Verification
```sql
-- Check gap-filled stages
SELECT 
  sgf.*,
  pj.wo_no,
  ps.name as stage_name
FROM schedule_gap_fills sgf
JOIN production_jobs pj ON pj.id = sgf.job_id
JOIN production_stages ps ON ps.id = sgf.production_stage_id
ORDER BY sgf.created_at DESC
LIMIT 20;

-- Check average time savings
SELECT 
  COUNT(*) as gap_fills,
  AVG(minutes_saved) as avg_minutes_saved,
  SUM(minutes_saved) / 60 as total_hours_saved
FROM schedule_gap_fills
WHERE created_at >= CURRENT_DATE - interval '7 days';
```

#### Impact
- ✅ Optimized resource utilization
- ✅ Shorter overall timelines
- ✅ Audit trail for gap-filling decisions
- ✅ Configurable per production stage
- ✅ No breaking changes to API
- ✅ Enhanced in v2.3 with tight packing

---

### September 30, 2025 - Time-Aware Scheduling Fix (v2.1)

**Migration**: `20250930105445_9e96197e-4198-4779-879e-dda2c28482a9.sql`

#### Problem Identified
- Nightly cron running at 3 AM was always scheduling from "next day 8 AM"
- On Monday morning at 3 AM, scheduler would skip to Tuesday 8 AM
- Result: Monday had no scheduled work, causing delays

#### Root Cause
- `simple_scheduler_wrapper()` had no `p_start_from` parameter
- Always calculated base_time as `next_working_start(tomorrow 8 AM)`
- No awareness of current time when cron executed

#### Solution Implemented

**1. Updated `simple_scheduler_wrapper()`**
```sql
-- BEFORE
CREATE FUNCTION simple_scheduler_wrapper(p_mode text DEFAULT 'reschedule_all')

-- AFTER
CREATE FUNCTION simple_scheduler_wrapper(
  p_mode text DEFAULT 'reschedule_all',
  p_start_from timestamptz DEFAULT NULL  -- NEW PARAMETER
)
```

**2. Updated `cron_nightly_reschedule_with_carryforward()`**
```sql
-- NEW: Calculate time-aware start
time_aware_start := public.next_working_start(now());

-- Pass to scheduler wrapper
PERFORM public.simple_scheduler_wrapper('reschedule_all', time_aware_start);
```

#### Behavior Changes

| Scenario | Before | After |
|----------|--------|-------|
| Mon 3 AM cron | Schedule Tue 8 AM | Schedule Mon 8 AM ✓ |
| Fri 3 AM cron | Schedule Sat 8 AM (Mon) | Schedule Fri 8 AM ✓ |
| Sat 3 AM cron | Schedule Sun 8 AM (Mon) | Schedule Mon 8 AM ✓ |
| UI manual | Schedule tomorrow 8 AM | Schedule tomorrow 8 AM (unchanged) |

#### Files Changed
1. `supabase/migrations/20250930105445_9e96197e-4198-4779-879e-dda2c28482a9.sql`
2. Function: `simple_scheduler_wrapper()`
3. Function: `cron_nightly_reschedule_with_carryforward()`

#### Verification
```sql
-- Test time-aware calculation
DO $$
DECLARE
  monday_3am timestamptz := '2025-10-06 03:00:00+02'::timestamptz;
  result timestamptz;
BEGIN
  result := public.next_working_start(monday_3am);
  RAISE NOTICE 'Mon 3 AM → %', result;
  -- Expected: 2025-10-06 08:00:00+02 (same day)
END $$;
```

#### Impact
- ✅ Fixes Monday scheduling gap
- ✅ No changes to core algorithm
- ✅ No changes to UI behavior
- ✅ Backward compatible (NULL → default behavior)
- ✅ No performance impact

---

### September 24, 2025 - Version 1.0 Milestone

**Status**: ✅ WORKING (superseded by v2.1)

#### Declared Working State
- Official working version declared
- Complete sequential scheduler with parallel awareness
- Documented in `SCHEDULER_VERSION_1.0_MILESTONE.md`

#### Key Configuration
- Function: `simple_scheduler_wrapper()` → `scheduler_reschedule_all_parallel_aware()`
- No append mode routing
- All reschedules use parallel-aware algorithm
- FIFO ordering by `proof_approved_at`

#### Known Working Behaviors
1. Sequential job processing (no race conditions)
2. Parallel stage awareness (cover/text/both)
3. Barrier-based convergence
4. Resource contention management
5. Proof approval triggers
6. Nightly automation at 3 AM

#### Issue
- Time calculation always used "tomorrow" base
- Not fixed until v2.1 (September 30, 2025)

---

### September 23, 2025 - Function Routing Restoration

**Migration**: Not tracked (manual fix)

#### Problem
- `simple_scheduler_wrapper()` was calling incorrect `_v2` variant
- Caused inconsistent scheduling behavior

#### Fix
- Restored call to original `scheduler_reschedule_all_parallel_aware()`
- Removed `_v2` variant references
- Verified routing in all entry points

#### Result
- Consistent scheduling behavior restored
- Declared as working state on September 24

---

### Pre-September 2025 - Evolution Period

**Status**: Iterative development

#### Key Developments
1. **Parallel-aware algorithm** developed
   - Barrier tracking for cover/text/both paths
   - Convergence handling for combined stages
   - Dependency group support

2. **Resource tracking** implemented
   - `_stage_tails` temporary table
   - Resource availability per stage
   - No double-booking logic

3. **Time calculation helpers** created
   - `next_working_start()`
   - `place_duration_sql()`
   - `is_working_day()`
   - `shift_window_enhanced()`

4. **Append-only mode** added
   - `scheduler_append_jobs()` function
   - Proof approval trigger integration
   - Preserves existing schedule

5. **Validation** implemented
   - `validate_job_scheduling_precedence()`
   - Checks stage ordering
   - Reports violations without blocking

---

## Configuration Evolution

### Cron Schedule

**Current** (All versions):
```sql
SELECT cron.schedule(
  'nightly-reschedule-consolidated',
  '0 3 * * *',
  $$ SELECT public.cron_nightly_reschedule_with_carryforward(); $$
);
```

**History**:
- Originally: Multiple separate cron jobs
- Consolidated: Single nightly job
- **Unchanged**: Schedule remains `0 3 * * *` (3 AM daily)

### Function Routing

**v2.1 (Current)**:
```
simple_scheduler_wrapper(p_mode, p_start_from)
  └─> scheduler_reschedule_all_parallel_aware(p_start_from)
```

**v1.0**:
```
simple_scheduler_wrapper(p_mode)
  └─> scheduler_reschedule_all_parallel_aware(NULL)
```

**Pre-v1.0** (Broken):
```
simple_scheduler_wrapper(p_mode)
  └─> scheduler_reschedule_all_parallel_aware_v2()  ❌ Wrong function
```

### Shift Configuration

**Consistent across all versions**:
- Start: 08:00 (8 AM)
- End: 16:30 (4:30 PM)
- Lunch: 13:00-13:30
- Capacity: 450 minutes/day

---

## Migration Timeline

```
Pre-Sept 2025
  ├─ Multiple development iterations
  ├─ Parallel-aware algorithm developed
  ├─ Resource tracking implemented
  └─ Append mode added
      ↓
Sept 23, 2025
  ├─ Function routing corrected
  └─ simple_scheduler_wrapper → scheduler_reschedule_all_parallel_aware
      ↓
Sept 24, 2025
  ├─ Version 1.0 declared WORKING
  ├─ Documentation: SCHEDULER_VERSION_1.0_MILESTONE.md
  └─ Protection protocols established
      ↓
Sept 30, 2025 (v2.1)
  ├─ Migration: 20250930105445_9e96197e-4198-4779-879e-dda2c28482a9.sql
  ├─ Added p_start_from parameter to simple_scheduler_wrapper
  ├─ Updated cron function for time-aware scheduling
  └─ Fixed Monday scheduling gap
      ↓
Oct 2, 2025 (v2.2)
  ├─ Migration: 20251002163603 & 20251002165724
  ├─ Two-phase scheduling: FIFO + Gap-Filling
  ├─ Added schedule_gap_fills audit table
  ├─ Added allow_gap_filling column to production_stages
  ├─ Stage-type-aware movement caps (21/30 days)
  └─ Dynamic lookback calculation
      ↓
Oct 3, 2025 (v2.3)
  ├─ Migration: 20251003112533 & 20251003114331
  ├─ Added p_align_at parameter to find_available_gaps()
  ├─ Tight packing: stages align to predecessor finish times
  ├─ Reduced threshold to 6 hours (0.25 days)
  └─ Zero-gap scheduling between dependent stages
      ↓
Oct 7, 2025 (v2.4)
  ├─ Migration: 20251007180644_4664bf1f-28d6-42b4-abf8-dcb5beffa0ab.sql
  ├─ Dynamic lookback (up to 90 days based on job spacing)
  ├─ Removed upper move cap for gap-filling stages
  ├─ Extended find_available_gaps scan window
  └─ Fixed regression preventing long-distance gap-fills
      ↓
CURRENT STATE (v2.4)
```

---

## Breaking Changes Log

### v2.1 (September 30, 2025)
**Breaking**: ❌ None
**Backward Compatible**: ✅ Yes

Changes:
- Added optional parameter `p_start_from` (defaults to NULL)
- NULL behavior unchanged (uses tomorrow 8 AM)
- Existing calls continue to work

### v1.0 (September 24, 2025)
**Breaking**: ❌ None (restoration, not change)
**Backward Compatible**: ✅ N/A (fixed from broken state)

Changes:
- Corrected function routing
- No API changes

---

## Function Signature Changes

### simple_scheduler_wrapper()

**v2.1** (Current):
```sql
simple_scheduler_wrapper(
  p_mode text DEFAULT 'reschedule_all',
  p_start_from timestamptz DEFAULT NULL
)
RETURNS jsonb
```

**v1.0**:
```sql
simple_scheduler_wrapper(
  p_mode text DEFAULT 'reschedule_all'
)
RETURNS jsonb
```

**Change**: Added optional `p_start_from` parameter

### scheduler_reschedule_all_parallel_aware()

**v2.1** (Current):
```sql
scheduler_reschedule_all_parallel_aware(
  p_start_from timestamptz DEFAULT NULL
)
RETURNS TABLE(wrote_slots int, updated_jsi int, violations jsonb)
```

**v1.0**:
```sql
scheduler_reschedule_all_parallel_aware()
RETURNS TABLE(wrote_slots int, updated_jsi int, violations jsonb)
```

**Change**: Added optional `p_start_from` parameter

### cron_nightly_reschedule_with_carryforward()

**v2.1** (Current):
```sql
-- Calculates time_aware_start
time_aware_start := next_working_start(now());
PERFORM simple_scheduler_wrapper('reschedule_all', time_aware_start);
```

**v1.0**:
```sql
-- No time-aware calculation
PERFORM simple_scheduler_wrapper('reschedule_all');
```

**Change**: Added time-aware start calculation

---

## Deprecated Features

### None Currently

All features from v1.0 remain active and supported in v2.1.

---

## Known Issues History

### ✅ RESOLVED: Monday Scheduling Gap (v2.1)
- **Identified**: September 30, 2025
- **Resolved**: September 30, 2025
- **Impact**: Medium (caused 1-day delays on Mondays)
- **Fix**: Time-aware scheduling implementation

### ✅ RESOLVED: Incorrect Function Routing (v1.0)
- **Identified**: September 23, 2025
- **Resolved**: September 24, 2025
- **Impact**: High (caused inconsistent scheduling)
- **Fix**: Corrected wrapper to call `scheduler_reschedule_all_parallel_aware()`

### ⚠️ MONITORING: Performance at Scale
- **Status**: Ongoing monitoring
- **Current**: < 30s for 300+ stages
- **Threshold**: Alert if > 60s
- **Mitigation**: Consider batch processing if needed

---

## Testing History

### September 30, 2025 - Time-Aware Scheduling Tests
```sql
✅ Test: Monday 3 AM → Monday 8 AM
✅ Test: Saturday 3 AM → Monday 8 AM
✅ Test: UI reschedule → Tomorrow 8 AM
✅ Test: Manual reschedule with p_start_from
✅ Test: Backward compatibility (NULL parameter)
```

### September 24, 2025 - v1.0 Verification Tests
```sql
✅ Test: Full reschedule completes successfully
✅ Test: Sequential processing (no conflicts)
✅ Test: Parallel stages handled correctly
✅ Test: Barrier convergence working
✅ Test: Resource tracking prevents double-booking
✅ Test: Proof approval trigger works
✅ Test: Nightly cron executes
```

---

## Performance Benchmarks

### v2.1 (Current)
- **Nightly cron**: 25-30 seconds
- **Manual reschedule**: 3-5 seconds
- **Stages processed**: 300-500
- **Memory usage**: ~10 MB

### v1.0
- **Nightly cron**: 25-30 seconds (same)
- **Manual reschedule**: 3-5 seconds (same)
- **Stages processed**: 300-500 (same)
- **Memory usage**: ~10 MB (same)

**Conclusion**: No performance regression in v2.1

---

## Documentation Updates

### September 30, 2025 (v2.1)
**New Documents**:
- `SCHEDULER_WORKING_STATE_MASTER.md` - Complete reference
- `SCHEDULER_FUNCTION_SIGNATURES.md` - API documentation
- `SCHEDULER_RESTORATION_GUIDE.md` - Recovery procedures
- `SCHEDULER_ARCHITECTURE_CURRENT.md` - Updated architecture
- `SCHEDULER_CHANGE_LOG.md` - This document

**Updated Documents**:
- None (new documentation suite replaces old)

**Deprecated Documents**:
- ⚠️ `SCHEDULER_VERSION_1.0_MILESTONE.md` - Superseded but kept for history
- ⚠️ `WORKING_SCHEDULER_ARCHITECTURE.md` - Superseded by ARCHITECTURE_CURRENT
- ⚠️ `SCHEDULER_PROTECTION_CHECKLIST.md` - Merged into RESTORATION_GUIDE

---

## Rollback Procedures

### From v2.1 to v1.0

If v2.1 causes issues, rollback:

```sql
-- 1. Restore v1.0 simple_scheduler_wrapper (no p_start_from)
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(
  p_mode text DEFAULT 'reschedule_all'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  result record;
  response jsonb;
BEGIN
  SET LOCAL statement_timeout = '120s';
  
  CASE p_mode
    WHEN 'reschedule_all' THEN
      SELECT * INTO result FROM public.scheduler_reschedule_all_parallel_aware();
      response := jsonb_build_object(
        'success', true,
        'scheduled_count', result.updated_jsi,
        'wrote_slots', result.wrote_slots,
        'violations', result.violations,
        'mode', 'parallel_aware'
      );
    ELSE
      RAISE EXCEPTION 'Unknown scheduler mode: %', p_mode;
  END CASE;
  RETURN response;
END;
$function$;

-- 2. Restore v1.0 cron function (no time-aware calculation)
CREATE OR REPLACE FUNCTION public.cron_nightly_reschedule_with_carryforward()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Carry forward overdue jobs
  UPDATE production_jobs 
  SET status = 'In Production'
  WHERE status = 'Approved' 
    AND due_date < CURRENT_DATE;
  
  -- Run full reschedule (no time-aware parameter)
  PERFORM public.simple_scheduler_wrapper('reschedule_all');
END;
$function$;
```

**Impact of Rollback**:
- ❌ Monday scheduling gap returns
- ✅ All other functionality unchanged
- ✅ No data loss

---

## Future Considerations

### Potential Enhancements
1. **Dynamic shift schedules**: Allow different shifts per day/department
2. **Priority-based scheduling**: Override FIFO for urgent jobs
3. **Real-time rescheduling**: React to completion events
4. **Capacity planning**: Forecast resource utilization
5. **Multi-site support**: Handle multiple factories

### Performance Improvements
1. **Batch processing**: Group similar stages together
2. **Parallel execution**: Process independent jobs concurrently
3. **Incremental updates**: Only reschedule affected jobs
4. **Caching**: Store frequently accessed data

### Monitoring Enhancements
1. **Alerting**: Notify on scheduling failures
2. **Metrics dashboard**: Real-time performance tracking
3. **Audit logging**: Detailed change tracking
4. **Predictive analytics**: Forecast scheduling issues

---

## Maintainer Notes

### When Adding New Changes

**Required Steps**:
1. Create migration file with descriptive name
2. Update this CHANGE_LOG.md with:
   - Date and version number
   - Problem description
   - Solution implementation
   - Files changed
   - Migration ID
   - Verification queries
   - Impact assessment
3. Update SCHEDULER_WORKING_STATE_MASTER.md with new working state
4. Update SCHEDULER_FUNCTION_SIGNATURES.md if APIs changed
5. Update SCHEDULER_ARCHITECTURE_CURRENT.md if algorithm changed
6. Test rollback procedure
7. Run full verification suite
8. Monitor first production execution

### Version Numbering

Format: `MAJOR.MINOR`

- **MAJOR**: Breaking changes, algorithm rewrites
- **MINOR**: New features, bug fixes, enhancements

Current: **2.1**

Next minor: **2.2**
Next major: **3.0**

---

**END OF CHANGE LOG**
**Last Updated: September 30, 2025**
**Maintained by: Development Team**
