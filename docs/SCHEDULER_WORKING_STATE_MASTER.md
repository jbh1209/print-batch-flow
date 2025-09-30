# Scheduler Working State Master Reference

**DEFINITIVE DOCUMENTATION - AS OF SEPTEMBER 30, 2025**

This document captures the **exact working configuration** of the production scheduler system. Use this as the authoritative reference for restoration.

---

## System Overview

### Architecture Type
**Parallel-Aware Sequential Scheduling with Time-Aware Start Times**

### Core Components
1. **Main Scheduler Function**: `scheduler_reschedule_all_parallel_aware()`
2. **Wrapper Function**: `simple_scheduler_wrapper()`
3. **Append Function**: `scheduler_append_jobs()`
4. **Nightly Cron**: `cron_nightly_reschedule_with_carryforward()`
5. **Helper Functions**: `place_duration_sql()`, `next_working_start()`, `is_working_day()`

---

## Critical Configuration Values

### Scheduling Parameters
- **Default shift start**: 8:00 AM (Africa/Johannesburg)
- **Default shift end**: 4:30 PM (16:30)
- **Lunch break**: 1:00 PM - 1:30 PM (30 minutes)
- **Daily capacity**: 450 minutes (7.5 hours)
- **Time horizon**: 60 working days
- **Statement timeout**: 120 seconds
- **Transaction timeout**: 300 seconds

### Cron Schedule
- **Frequency**: Every night at 3:00 AM (Africa/Johannesburg)
- **Cron expression**: `0 3 * * *`
- **Function called**: `cron_nightly_reschedule_with_carryforward()`

---

## Complete Function Definitions

### 1. simple_scheduler_wrapper()

**CURRENT WORKING VERSION** (Updated September 30, 2025)

```sql
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(
  p_mode text DEFAULT 'reschedule_all'::text,
  p_start_from timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '180s'
SET idle_in_transaction_session_timeout TO '300s'
AS $function$
DECLARE
  result record;
  response jsonb;
BEGIN
  SET LOCAL statement_timeout = '120s';
  SET LOCAL idle_in_transaction_session_timeout = '300s';
  
  CASE p_mode
    WHEN 'reschedule_all' THEN
      -- Pass p_start_from to the parallel-aware scheduler
      SELECT * INTO result FROM public.scheduler_reschedule_all_parallel_aware(p_start_from);
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
```

**Key Features:**
- Accepts optional `p_start_from` parameter for time-aware scheduling
- Routes all `reschedule_all` calls to `scheduler_reschedule_all_parallel_aware()`
- Returns structured JSONB response with metrics

---

### 2. cron_nightly_reschedule_with_carryforward()

**CURRENT WORKING VERSION** (Updated September 30, 2025)

```sql
CREATE OR REPLACE FUNCTION public.cron_nightly_reschedule_with_carryforward()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  time_aware_start timestamptz;
BEGIN
  -- Calculate time-aware start: if 3 AM on working day, schedule for 8 AM same day
  time_aware_start := public.next_working_start(now());
  
  RAISE NOTICE 'Nightly cron starting at %, will schedule from %', now(), time_aware_start;
  
  -- Carry forward overdue jobs
  UPDATE production_jobs 
  SET status = 'In Production'
  WHERE status = 'Approved' 
    AND due_date < CURRENT_DATE;
  
  -- Run full reschedule with time-aware start time
  PERFORM public.simple_scheduler_wrapper('reschedule_all', time_aware_start);
END;
$function$;
```

**Key Features:**
- Calculates time-aware start using `next_working_start(now())`
- Carries forward overdue approved jobs
- Passes calculated start time to scheduler wrapper
- **Critical**: Ensures 3 AM cron schedules for 8 AM same day on working days

---

### 3. scheduler_reschedule_all_parallel_aware()

**CURRENT WORKING VERSION** (See supabase-info section for complete source)

**Signature:**
```sql
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware(
  p_start_from timestamptz DEFAULT NULL
)
RETURNS TABLE(
  wrote_slots integer,
  updated_jsi integer,
  violations jsonb
)
```

**Key Algorithm Steps:**
1. **Advisory lock**: Prevents concurrent scheduling runs
2. **Time calculation**: Determines base scheduling time from `p_start_from` or `next_working_start(tomorrow)`
3. **Clear non-completed slots**: Removes existing schedule data for non-completed stages
4. **Initialize stage availability**: Creates `_stage_tails` temp table tracking resource availability
5. **Process jobs in FIFO order**: Sorts by `proof_approved_at ASC`
6. **Handle parallel stages**: Uses barrier tracking for cover/text/both parts
7. **Place duration**: Calls `place_duration_sql()` for each stage
8. **Update slots and instances**: Writes to `stage_time_slots` and `job_stage_instances`
9. **Validate precedence**: Runs `validate_job_scheduling_precedence()`

---

### 4. scheduler_append_jobs()

**CURRENT WORKING VERSION**

```sql
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs(
  p_job_ids uuid[],
  p_only_if_unset boolean DEFAULT true
)
RETURNS TABLE(
  wrote_slots integer,
  updated_jsi integer,
  violations jsonb
)
```

**Purpose:** Append-only scheduling for newly approved jobs without rescheduling existing jobs

**Key Features:**
- Only schedules jobs in `p_job_ids` array
- Respects existing resource availability
- Uses same `place_duration_sql()` and barrier logic
- Validates only affected jobs

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ ENTRY POINTS                                                     │
├─────────────────────────────────────────────────────────────────┤
│ 1. Nightly Cron (3 AM)                                          │
│    └─> cron_nightly_reschedule_with_carryforward()             │
│         └─> time_aware_start = next_working_start(now())       │
│              └─> simple_scheduler_wrapper('reschedule_all',    │
│                   time_aware_start)                             │
│                                                                  │
│ 2. UI Reschedule Button                                        │
│    └─> simple_scheduler_wrapper('reschedule_all')              │
│                                                                  │
│ 3. Proof Approval Trigger                                      │
│    └─> scheduler_append_jobs([job_id])                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ SCHEDULER CORE                                                   │
├─────────────────────────────────────────────────────────────────┤
│ scheduler_reschedule_all_parallel_aware(p_start_from)          │
│                                                                  │
│ 1. Acquire advisory lock (1, 42)                               │
│ 2. Calculate base_time:                                        │
│    - If p_start_from provided: use next_working_start(p_start) │
│    - Else: next_working_start(tomorrow)                        │
│ 3. Clear non-completed slots & schedule data                   │
│ 4. Initialize _stage_tails temp table                          │
│ 5. Load resource availability from completed slots             │
│                                                                  │
│ FOR EACH JOB (ORDER BY proof_approved_at ASC):                 │
│   ├─ Initialize barriers from completed stages                 │
│   ├─ FOR EACH STAGE GROUP (ORDER BY stage_order ASC):         │
│   │   ├─ Calculate earliest_start from barriers               │
│   │   ├─ Get resource availability from _stage_tails          │
│   │   ├─ earliest_start = GREATEST(barrier, resource)         │
│   │   ├─ place_duration_sql(earliest_start, duration, 60)    │
│   │   ├─ INSERT INTO stage_time_slots                         │
│   │   ├─ UPDATE job_stage_instances                           │
│   │   ├─ UPDATE _stage_tails with new availability           │
│   │   └─ UPDATE barriers (cover/text/both/main)              │
│   └─ CONTINUE                                                   │
│                                                                  │
│ 6. Run validate_job_scheduling_precedence()                    │
│ 7. RETURN (wrote_count, updated_count, violations)             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ HELPER FUNCTIONS                                                 │
├─────────────────────────────────────────────────────────────────┤
│ • place_duration_sql(start_time, duration, horizon_days)       │
│   └─> Returns JSONB array of time slots                        │
│                                                                  │
│ • next_working_start(check_time)                               │
│   └─> Returns next valid working moment                        │
│                                                                  │
│ • is_working_day(check_date)                                   │
│   └─> Returns boolean (excludes weekends/holidays)            │
│                                                                  │
│ • shift_window_enhanced(check_date)                            │
│   └─> Returns (shift_start, shift_end)                        │
│                                                                  │
│ • jsi_minutes(scheduled, estimated)                            │
│   └─> Returns effective duration                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ DATABASE UPDATES                                                 │
├─────────────────────────────────────────────────────────────────┤
│ • stage_time_slots: Time slot allocations                      │
│ • job_stage_instances: Schedule times and status               │
│ • _stage_tails: Resource availability (temp table)             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Critical Tables and Structures

### Temporary Table: _stage_tails
```sql
CREATE TEMP TABLE _stage_tails (
  stage_id uuid PRIMARY KEY,
  next_available_time timestamptz NOT NULL
);
```
**Purpose:** Track when each production stage resource becomes available
**Lifecycle:** Created per scheduling run, destroyed after completion
**Updates:** After each stage placement

### Persistent Tables

#### stage_time_slots
**Purpose:** Store allocated time slots
**Key columns:**
- `production_stage_id`: Which stage/resource
- `job_id`: Which job
- `stage_instance_id`: Which specific stage instance
- `slot_start_time`: When slot starts
- `slot_end_time`: When slot ends
- `duration_minutes`: Slot duration
- `is_completed`: Whether work is done

#### job_stage_instances
**Purpose:** Store stage schedule and status
**Key columns:**
- `scheduled_start_at`: Calculated start time
- `scheduled_end_at`: Calculated end time
- `scheduled_minutes`: Total duration
- `schedule_status`: 'scheduled' | 'unscheduled'
- `status`: 'pending' | 'active' | 'completed'
- `part_assignment`: 'cover' | 'text' | 'both' | NULL

---

## Cron Job Configuration

### Cron Entry in pg_cron
```sql
SELECT cron.schedule(
  'nightly-reschedule-consolidated',
  '0 3 * * *',  -- Every day at 3:00 AM
  $$
  SELECT public.cron_nightly_reschedule_with_carryforward();
  $$
);
```

**Timezone:** Africa/Johannesburg (SAST/UTC+2)
**Function called:** `cron_nightly_reschedule_with_carryforward()`
**Expected behavior:** 
- Runs at 3:00 AM
- Calculates `next_working_start(now())`
- If Monday 3 AM on working day → schedules from 8 AM Monday
- If Saturday 3 AM → schedules from 8 AM Monday
- Carries forward overdue approved jobs

---

## Critical Business Rules

### Job Selection Criteria
```sql
WHERE pj.proof_approved_at IS NOT NULL  -- Only approved jobs
  AND COALESCE(jsi.status, '') NOT IN ('completed', 'active')  -- Skip finished
  AND ps.name NOT ILIKE '%dtp%'  -- Exclude DTP stages
  AND ps.name NOT ILIKE '%proof%'  -- Exclude proof stages
  AND ps.name NOT ILIKE '%batch%allocation%'  -- Exclude batch allocation
```

### Ordering Logic
```sql
ORDER BY 
  pj.proof_approved_at ASC,  -- FIFO by approval time
  jsi.stage_order ASC        -- Sequential stage order within job
```

### Part Assignment Logic
- **'cover'**: Cover-specific stages (e.g., laminating covers)
- **'text'**: Text-specific stages (e.g., text printing)
- **'both'**: Combined stages that need both parts (e.g., gathering)
- **NULL/'main'**: General stages in main workflow

### Barrier Management for Parallel Stages
- **cover barrier**: Tracks cover path completion time
- **text barrier**: Tracks text path completion time
- **both barrier**: Tracks combined path completion time
- **main barrier**: Maximum of all barriers (convergence point)

**Critical Rule**: Combined stages (`part_assignment='both'`) must wait for **MAXIMUM** of cover and text barriers

---

## Success Metrics (Current Production)

### Nightly Cron Performance
- **Total stages processed**: ~323
- **Execution time**: < 30 seconds
- **Success rate**: 100%
- **Memory usage**: Temp table + result sets
- **Database load**: Single transaction, minimal locking

### Manual Reschedule Performance
- **Response time**: < 5 seconds for full reschedule
- **UI feedback**: Real-time progress updates
- **Validation**: Automatic precedence checking

---

## Known Working Behaviors

✅ **Correct Behaviors (DO NOT CHANGE):**

1. **Time-aware scheduling**: 3 AM cron schedules for 8 AM same day on working days
2. **FIFO ordering**: Jobs processed by `proof_approved_at` ascending
3. **Sequential processing**: No race conditions or conflicts
4. **Barrier convergence**: Combined stages wait for all dependencies
5. **Resource awareness**: Stages scheduled based on resource availability
6. **Completed slot preservation**: Keeps history of finished work
7. **Proof approval triggers**: Automatically appends newly approved jobs
8. **60-day horizon**: Places work up to 60 working days ahead
9. **Lunch break handling**: Correctly splits work around 1:00-1:30 PM
10. **Weekend/holiday exclusion**: Only schedules on working days

---

## Verification Queries

### Check Scheduler Function
```sql
SELECT 
  proname,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname = 'simple_scheduler_wrapper';
```

### Check Cron Configuration
```sql
SELECT * FROM cron.job 
WHERE jobname LIKE '%reschedule%';
```

### Verify Recent Scheduling
```sql
SELECT 
  COUNT(*) as total_slots,
  MIN(slot_start_time) as earliest_start,
  MAX(slot_end_time) as latest_end
FROM stage_time_slots
WHERE slot_start_time >= CURRENT_DATE;
```

### Check Stage Availability
```sql
SELECT 
  ps.name as stage_name,
  MAX(sts.slot_end_time) as next_available
FROM stage_time_slots sts
JOIN production_stages ps ON ps.id = sts.production_stage_id
WHERE sts.is_completed = false
GROUP BY ps.id, ps.name
ORDER BY ps.name;
```

---

## Protection Protocols

### NEVER MODIFY WITHOUT EXPLICIT AUTHORIZATION:
1. `simple_scheduler_wrapper()` - Entry point routing
2. `scheduler_reschedule_all_parallel_aware()` - Core algorithm
3. `cron_nightly_reschedule_with_carryforward()` - Nightly automation
4. `place_duration_sql()` - Time placement logic
5. `next_working_start()` - Working time calculation
6. `_stage_tails` structure - Resource tracking
7. Job ordering: `proof_approved_at ASC`
8. Barrier management: cover/text/both logic
9. Cron schedule: `0 3 * * *`

### ALWAYS REQUIRE:
- Full system backup before changes
- Migration script with rollback
- Test on non-production data first
- Verification query execution
- Performance measurement comparison

---

**END OF MASTER REFERENCE**
**Last Updated: September 30, 2025**
**Status: WORKING - DO NOT MODIFY**
