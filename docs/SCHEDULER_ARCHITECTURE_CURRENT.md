# Scheduler Architecture - Current Working State

**UPDATED: OCTOBER 7, 2025 (v2.4)**

This document describes the current working architecture of the production scheduler system, replacing all outdated architectural references.

---

## Architecture Type

**Parallel-Aware Sequential Scheduling with Dynamic Gap-Filling Optimization and Tight Packing**

### Key Characteristics
- **Two-phase scheduling**: FIFO sequential + backward gap-filling optimization
- **Dynamic lookback**: Calculates scan window based on actual job spacing (7-90 days)
- **Intelligent gap-filling**: No artificial distance caps for finishing stages
- **Parallel stage awareness**: Handles concurrent stages within jobs (cover/text paths)
- **Resource contention management**: Tracks when each production stage becomes available
- **Time-aware scheduling**: Considers current time when calculating start times
- **Barrier-based convergence**: Uses barriers to synchronize parallel workflow paths
- **Tight packing**: Aligns stages precisely to predecessor finish times (zero-gap scheduling)
- **Working day aware**: Only schedules on weekdays, excluding holidays

---

## System Entry Points

### 1. Nightly Automated Scheduling
```
Cron (3 AM SAST)
    ↓
cron_nightly_reschedule_with_carryforward()
    ├─ Calculate time_aware_start = next_working_start(now())
    ├─ Carry forward overdue approved jobs
    └─ simple_scheduler_wrapper('reschedule_all', time_aware_start)
```

**Critical Feature**: Time-aware start calculation
- 3 AM Monday → Schedules from 8 AM Monday (same day)
- 3 AM Saturday → Schedules from 8 AM Monday (next working day)

### 2. UI Manual Reschedule
```
User clicks "Reschedule All"
    ↓
Frontend calls supabase.rpc('simple_scheduler_wrapper', {p_mode: 'reschedule_all'})
    ↓
simple_scheduler_wrapper('reschedule_all', NULL)
    ↓
Base time = next_working_start(tomorrow 8 AM)
```

### 3. Proof Approval Trigger
```
User approves proof manually
    ↓
UPDATE job_stage_instances SET proof_approved_manually_at = now()
    ↓
TRIGGER trg_schedule_on_proof_approval
    ↓
scheduler_append_jobs([job_id], true)
    ↓
Appends job to existing schedule
```

---

## Core Algorithm: Two-Phase Scheduling with Gap-Filling

### High-Level Flow

```
START scheduler_reschedule_all_parallel_aware(p_start_from)
  │
  ├─ PHASE 1: FIFO SEQUENTIAL SCHEDULING
  │   │
  │   ├─ 1. INITIALIZATION
  │   │   ├─ Acquire advisory lock pg_advisory_xact_lock(1, 42)
  │   │   ├─ Calculate base_time from p_start_from or default
  │   │   ├─ Clear non-completed schedule data
  │   │   ├─ Create _stage_tails temp table
  │   │   └─ Initialize resource availability
  │   │
  │   ├─ 2. JOB SELECTION
  │   │   └─ SELECT jobs WHERE proof_approved_at IS NOT NULL
  │   │      ORDER BY proof_approved_at ASC  (FIFO)
  │   │
  │   ├─ 3. FOR EACH JOB (Sequential)
  │   │   │
  │   │   ├─ 3.1 Initialize job-specific barriers
  │   │   │   ├─ main_barrier = MAX(base_time, proof_approved_at)
  │   │   │   ├─ cover_barrier = main_barrier
  │   │   │   ├─ text_barrier = main_barrier
  │   │   │   └─ both_barrier = main_barrier
  │   │   │
  │   │   ├─ 3.2 Load completed stage times into barriers
  │   │   │
  │   │   └─ 3.3 FOR EACH STAGE GROUP (by stage_order)
  │   │       │
  │   │       └─ 3.4 FOR EACH STAGE IN GROUP (Parallel stages)
  │   │           │
  │   │           ├─ 3.4.1 Determine barrier time
  │   │           │   ├─ IF part_assignment = 'both':
  │   │           │   │   earliest_start = MAX(cover_barrier, text_barrier, main_barrier)
  │   │           │   └─ ELSE:
  │   │           │       earliest_start = specific_barrier (cover/text/main)
  │   │           │
  │   │           ├─ 3.4.2 Get resource availability
  │   │           │   resource_available = _stage_tails[production_stage_id]
  │   │           │
  │   │           ├─ 3.4.3 Calculate actual start
  │   │           │   actual_start = MAX(earliest_start, resource_available)
  │   │           │
  │   │           ├─ 3.4.4 Place duration
  │   │           │   slots = place_duration_sql(actual_start, duration, 60 days)
  │   │           │
  │   │           ├─ 3.4.5 Write time slots
  │   │           │   INSERT INTO stage_time_slots (slots data)
  │   │           │
  │   │           ├─ 3.4.6 Update job stage instance
  │   │           │   UPDATE job_stage_instances SET
  │   │           │     scheduled_start_at = slots[0].start_time,
  │   │           │     scheduled_end_at = slots[-1].end_time,
  │   │           │     scheduled_minutes = duration,
  │   │           │     schedule_status = 'scheduled'
  │   │           │
  │   │           ├─ 3.4.7 Update resource availability
  │   │           │   _stage_tails[production_stage_id] = stage_end_time
  │   │           │
  │   │           └─ 3.4.8 Update barriers
  │   │               IF part_assignment = 'both':
  │   │                 cover_barrier = text_barrier = main_barrier = stage_end_time
  │   │               ELSE:
  │   │                 specific_barrier = stage_end_time
  │   │                 main_barrier = MAX(all barriers)
  │
  ├─ PHASE 2: GAP-FILLING OPTIMIZATION PASS (NEW in v2.2)
  │   │
  │   ├─ 4. IDENTIFY GAP-FILL CANDIDATES
  │   │   └─ SELECT stages WHERE:
  │   │      ├─ scheduled_minutes <= 120 (short stages only)
  │   │      ├─ allow_gap_filling = true (on production_stage)
  │   │      ├─ schedule_status = 'scheduled' (not completed)
  │   │      └─ scheduled_start_at > now() + 6 hours (future stages)
  │   │
  │   ├─ 5. FOR EACH CANDIDATE (Order by scheduled_start DESC)
  │   │   │
  │   │   ├─ 5.1 Calculate earliest_possible_start
  │   │   │   ├─ Check predecessor stages (by stage_order)
  │   │   │   └─ earliest_possible = MAX(predecessor_ends, base_time)
  │   │   │
  │   │   ├─ 5.2 Determine lookback window (ENHANCED in v2.4)
  │   │   │   ├─ days_back_to_prev = (scheduled_start - earliest_possible_start) / 86400
  │   │   │   ├─ lookback_days = MIN(90, MAX(7, FLOOR(days_back_to_prev)))
  │   │   │   └─ Dynamic: adjusts to actual job spacing (not fixed cap)
  │   │   │
  │   │   ├─ 5.3 Find best gap using find_available_gaps()
  │   │   │   find_available_gaps(
  │   │   │     p_stage_id,
  │   │   │     p_minutes_needed,
  │   │   │     p_original_start,
  │   │   │     p_lookback_days,
  │   │   │     p_align_at = earliest_possible_start  -- NEW in v2.3
  │   │   │   )
  │   │   │   ├─ scan_start includes earliest_possible_start date (v2.4)
  │   │   │   └─ Extended window ensures predecessor dates are scanned
  │   │   │
  │   │   ├─ 5.4 Validate gap candidate (RELAXED in v2.4)
  │   │   │   ├─ gap_start >= earliest_possible_start
  │   │   │   ├─ gap_start >= GREATEST(gap_start, earliest_possible, now())
  │   │   │   ├─ savings >= 6 hours (0.25 days) -- Updated in v2.3
  │   │   │   ├─ NO UPPER CAP for allow_gap_filling=true stages (NEW in v2.4)
  │   │   │   └─ No violations of job-level dependencies
  │   │   │
  │   │   ├─ 5.5 Move stage if beneficial
  │   │   │   ├─ Delete old time slots
  │   │   │   ├─ Place duration at new aligned time
  │   │   │   ├─ Insert new time slots
  │   │   │   ├─ Update job_stage_instances
  │   │   │   └─ Log to schedule_gap_fills
  │   │   │
  │   │   └─ 5.6 Update metrics
  │   │       └─ gap_filled_count++
  │
  ├─ 6. VALIDATION
  │   └─ Run validate_job_scheduling_precedence()
  │
  └─ 7. RETURN RESULTS
      └─ (wrote_slots, updated_jsi, violations, gap_filled_count)
END
```

### Key Enhancement: Tight Packing (v2.3)

**Problem:** In v2.2, stages would start at gap beginning even if predecessor finished mid-gap

**Solution:** `find_available_gaps()` now accepts `p_align_at` parameter

```sql
-- Actual gap start calculation (v2.3)
actual_gap_start := GREATEST(
  gap_start,           -- Gap window opens
  p_align_at,          -- Predecessor finishes (NEW)
  now()                -- Can't schedule in past
);
```

**Result:** Zero-gap packing between dependent stages

**Example:**
```
Predecessor ends: 10:30 AM
Gap available: 8:00 AM - 12:00 PM

v2.2: Stage starts at 8:00 AM (1.5 hours wasted)
v2.3: Stage starts at 10:30 AM (zero waste) ✓
```

---

## Parallel Stage Handling with Barriers

### Barrier Concept

Barriers track when parallel workflow paths are ready. Critical for jobs with split workflows (e.g., covers and text printed separately, then combined).

### Barrier Types

1. **main barrier**: Tracks main workflow path (default)
2. **cover barrier**: Tracks cover-specific stages (laminating, etc.)
3. **text barrier**: Tracks text-specific stages (text printing, etc.)
4. **both barrier**: Tracks combined stages (gathering, binding, etc.)

### Part Assignment Flow

```
Job starts (proof_approved_at)
    ↓
┌────────────────────┬────────────────────┐
│   COVER PATH       │    TEXT PATH       │
│   (part='cover')   │   (part='text')    │
├────────────────────┼────────────────────┤
│ Stage A (cover)    │ Stage X (text)     │
│   ↓                │   ↓                │
│ cover_barrier → T1 │ text_barrier → T2  │
│   ↓                │   ↓                │
│ Stage B (cover)    │ Stage Y (text)     │
│   ↓                │   ↓                │
│ cover_barrier → T3 │ text_barrier → T4  │
└────────────────────┴────────────────────┘
              ↓
    ┌─────────────────────┐
    │   CONVERGENCE       │
    │   (part='both')     │
    ├─────────────────────┤
    │ Stage Z (gathering) │
    │ Waits for:          │
    │   MAX(T3, T4)       │
    │ (both paths done)   │
    └─────────────────────┘
```

### Critical Rule

**Combined stages** (`part_assignment='both'`) MUST wait for ALL relevant barriers:

```sql
IF part_assignment = 'both' THEN
  stage_earliest_start := GREATEST(
    cover_barrier,
    text_barrier,
    main_barrier
  );
END IF;
```

This ensures gathering/binding doesn't start until ALL parts are ready.

---

## Time Calculation Logic

### Base Time Determination

```sql
IF p_start_from IS NULL THEN
  base_time := next_working_start(
    date_trunc('day', now() AT TIME ZONE 'utc') + interval '1 day'
  );
ELSE
  base_time := next_working_start(p_start_from);
END IF;
```

**Scenarios:**

| Call Type | p_start_from | Result |
|-----------|--------------|--------|
| UI Reschedule | NULL | Tomorrow 8 AM |
| Nightly Cron (Mon 3 AM) | next_working_start(now()) | Monday 8 AM (same day) |
| Nightly Cron (Sat 3 AM) | next_working_start(now()) | Monday 8 AM (next working day) |

### Working Time Calculation

```
next_working_start(timestamp) algorithm:
  1. Check if timestamp is within working hours (8 AM - 4:30 PM)
  2. If within working hours AND working day:
     - If in lunch break (1-1:30 PM): return 1:30 PM
     - Else: return timestamp
  3. If before working hours:
     - Return shift_start (8 AM)
  4. If after working hours OR non-working day:
     - Advance to next working day
     - Return shift_start (8 AM)
  5. Skip weekends (Saturday=6, Sunday=0)
  6. Skip public holidays (from public_holidays table)
```

---

## Resource Availability Tracking

### _stage_tails Temporary Table

**Purpose**: Track when each production stage resource becomes available

**Structure**:
```sql
CREATE TEMP TABLE _stage_tails (
  stage_id uuid PRIMARY KEY,          -- production_stage_id
  next_available_time timestamptz     -- When stage is free for next job
);
```

**Lifecycle**:
1. Created at start of scheduler run
2. Initialized with base_time for all stages
3. Loaded with completed slot end times
4. Updated after each stage placement
5. Destroyed at end of transaction

**Update Logic**:
```sql
-- After placing a stage
UPDATE _stage_tails 
SET next_available_time = stage_end_time
WHERE stage_id = production_stage_id;
```

This prevents double-booking resources (e.g., two jobs on same printer at same time).

---

## Time Slot Placement

### place_duration_sql() Function

**Purpose**: Place work duration across working hours, handling shifts and breaks

**Parameters**:
- `p_start_time`: Earliest possible start
- `p_duration_minutes`: Total duration to place
- `p_horizon_days`: Maximum days to search (default 60)

**Algorithm**:
```
1. Start from p_start_time
2. Find next working moment using next_working_start()
3. Get shift window for that day (8 AM - 4:30 PM)
4. Calculate available time in current slot:
   - Before lunch: 8 AM - 1 PM (5 hours)
   - After lunch: 1:30 PM - 4:30 PM (3 hours)
5. Place as much duration as fits in current slot
6. If duration remaining:
   - Move to next working day
   - Repeat from step 2
7. Return array of time slots
```

**Example**:
```
Duration: 8 hours (480 minutes)
Start: Monday 8 AM

Slots created:
[
  { date: "Mon", start: "08:00", end: "13:00", duration: 300 },  // 5 hrs before lunch
  { date: "Mon", start: "13:30", end: "16:30", duration: 180 },  // 3 hrs after lunch
]
Total: 480 minutes (8 hours) placed in 1 working day
```

---

## Data Model

### Key Tables

#### stage_time_slots
**Purpose**: Record of scheduled time allocations

```sql
stage_time_slots (
  id uuid PRIMARY KEY,
  production_stage_id uuid,      -- Which resource
  job_id uuid,                    -- Which job
  stage_instance_id uuid,         -- Which specific stage
  date date,                      -- Calendar date
  slot_start_time timestamptz,    -- Slot begins
  slot_end_time timestamptz,      -- Slot ends
  duration_minutes integer,       -- Length
  is_completed boolean            -- Whether work is done
)
```

#### job_stage_instances
**Purpose**: Stage records with schedule data

```sql
job_stage_instances (
  id uuid PRIMARY KEY,
  job_id uuid,
  production_stage_id uuid,
  stage_order integer,            -- Workflow sequence
  part_assignment text,           -- cover/text/both/NULL
  dependency_group uuid,          -- For parallel stages
  status text,                    -- pending/active/completed
  scheduled_start_at timestamptz, -- Calculated start
  scheduled_end_at timestamptz,   -- Calculated end
  scheduled_minutes integer,      -- Total duration
  schedule_status text,           -- scheduled/unscheduled
  estimated_duration_minutes int  -- System estimate
)
```

---

## Performance Characteristics

### Scalability

| Metric | Value | Notes |
|--------|-------|-------|
| Jobs processed | 50-300 | Current production range |
| Stages per job | 5-15 | Typical workflow length |
| Total stages | 300-500 | Per scheduling run |
| Execution time | < 30s | Nightly cron |
| Memory usage | ~10 MB | Temp table + results |
| Database load | Low | Single transaction |
| Lock contention | None | Advisory lock prevents concurrency |

### Time Complexity

- **Job processing**: O(n) - Linear with job count
- **Stage processing**: O(n × m) - Jobs × stages per job
- **Duration placement**: O(d) - Working days searched
- **Overall**: O(n × m × d) but d is constant (60 days)

### Optimization Strategies

1. **Single SQL transaction**: Avoids commit overhead
2. **Temp table for resource tracking**: Fast in-memory lookups
3. **Advisory lock**: Prevents concurrent execution conflicts
4. **FIFO ordering**: Simple, predictable, no complex sorting
5. **Minimal validation**: Only precedence checks

---

## Critical Configuration

### Shift Schedule (Default)
```
Shift start:  08:00 (8 AM)
Shift end:    16:30 (4:30 PM)
Lunch break:  13:00 - 13:30 (30 minutes)
Daily capacity: 450 minutes (7.5 hours)
```

### Timeouts
```
Statement timeout:          120 seconds
Idle timeout:               300 seconds
Function timeout (wrapper): 180 seconds
```

### Scheduling Parameters
```
Time horizon:       60 working days
Default duration:   60 minutes (if not specified)
Timezone:          Africa/Johannesburg (SAST/UTC+2)
```

---

## Error Handling

### Transaction Rollback

All scheduler operations run in a single transaction. If ANY error occurs:

1. Advisory lock is released
2. All changes are rolled back:
   - No time slots written
   - No job stages updated
   - No resource availability changed
3. Error is propagated to caller
4. Schedule remains in previous state

### Validation

After scheduling completes, `validate_job_scheduling_precedence()` checks:

- Stages scheduled in correct order (by stage_order)
- Dependencies satisfied
- Part barriers respected

If violations found, they're returned in response but don't block scheduling.

---

## Comparison to Old Architecture

### What Changed from v1.0 (September 24, 2025)

**BEFORE** (v1.0):
- `simple_scheduler_wrapper()` had no `p_start_from` parameter
- Always scheduled from "tomorrow 8 AM"
- 3 AM cron → scheduled from 8 AM next day (wrong on Mondays)

**NOW** (Current):
- `simple_scheduler_wrapper(p_mode, p_start_from)` accepts optional start time
- `cron_nightly_reschedule_with_carryforward()` calculates time-aware start
- 3 AM Monday cron → schedules from 8 AM Monday (correct)

**Migration**: `20250930105445_9e96197e-4198-4779-879e-dda2c28482a9.sql`

### What Stayed the Same (Working)

✅ Sequential processing (no race conditions)
✅ FIFO ordering by `proof_approved_at`
✅ Parallel-aware barrier management
✅ Resource contention handling
✅ 60-day placement horizon
✅ Lunch break handling
✅ Weekend/holiday exclusion
✅ Proof approval trigger
✅ Validation checks

---

## Monitoring Points

### Health Checks

```sql
-- Check recent scheduling success
SELECT 
  jobname,
  status,
  start_time,
  end_time,
  EXTRACT(EPOCH FROM (end_time - start_time)) as duration_seconds
FROM cron.job_run_details
WHERE jobname = 'nightly-reschedule-consolidated'
ORDER BY start_time DESC LIMIT 7;

-- Check schedule coverage
SELECT 
  DATE(slot_start_time) as schedule_date,
  COUNT(*) as slots,
  COUNT(DISTINCT job_id) as unique_jobs,
  SUM(duration_minutes) as total_minutes
FROM stage_time_slots
WHERE is_completed = false
  AND slot_start_time >= CURRENT_DATE
GROUP BY DATE(slot_start_time)
ORDER BY schedule_date
LIMIT 10;

-- Check for violations
SELECT * FROM validate_job_scheduling_precedence();
```

---

**END OF ARCHITECTURE DOCUMENT**
**Last Updated: October 7, 2025 (v2.4)**
**Supersedes: SCHEDULER_VERSION_1.0_MILESTONE.md, WORKING_SCHEDULER_ARCHITECTURE.md**
