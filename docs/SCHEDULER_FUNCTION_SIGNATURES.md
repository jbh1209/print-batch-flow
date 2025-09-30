# Scheduler Function Signatures Reference

**COMPLETE API DOCUMENTATION - AS OF SEPTEMBER 30, 2025**

This document provides complete signatures, parameters, return formats, and dependencies for all scheduler functions.

---

## Core Scheduler Functions

### simple_scheduler_wrapper()

**Entry point for all scheduling operations**

```sql
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(
  p_mode text DEFAULT 'reschedule_all'::text,
  p_start_from timestamptz DEFAULT NULL
)
RETURNS jsonb
```

#### Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `p_mode` | text | `'reschedule_all'` | Scheduling mode (currently only supports 'reschedule_all') |
| `p_start_from` | timestamptz | `NULL` | Optional start time for scheduling. If NULL, uses next working day at 8 AM |

#### Returns
```typescript
{
  success: boolean,
  scheduled_count: integer,  // Number of job stages updated
  wrote_slots: integer,      // Number of time slots created
  violations: jsonb,         // Array of precedence violations
  mode: string              // Confirms which scheduler was used
}
```

#### Example Response
```json
{
  "success": true,
  "scheduled_count": 145,
  "wrote_slots": 287,
  "violations": [],
  "mode": "parallel_aware"
}
```

#### Calls
- `scheduler_reschedule_all_parallel_aware(p_start_from)`

#### Used By
- UI reschedule button
- `cron_nightly_reschedule_with_carryforward()`
- Manual API calls

---

### scheduler_reschedule_all_parallel_aware()

**Main scheduling algorithm with parallel-aware barrier management**

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

#### Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `p_start_from` | timestamptz | `NULL` | Base scheduling time. If NULL, uses `next_working_start(tomorrow)` |

#### Returns
| Column | Type | Description |
|--------|------|-------------|
| `wrote_slots` | integer | Number of time slots written to `stage_time_slots` |
| `updated_jsi` | integer | Number of job stage instances updated |
| `violations` | jsonb | Array of scheduling precedence violations |

#### Violations Format
```typescript
[
  {
    job_id: uuid,
    wo_no: string,
    stage_id: uuid,
    stage_name: string,
    violation_type: string,
    details: string
  }
]
```

#### Algorithm Steps
1. Acquire advisory lock `pg_advisory_xact_lock(1, 42)`
2. Determine base time from `p_start_from` or default
3. Clear non-completed slots and schedule data
4. Initialize `_stage_tails` temp table
5. Load resource availability from completed slots
6. Process jobs in FIFO order by `proof_approved_at`
7. For each stage group:
   - Calculate barrier times (cover/text/both/main)
   - Get resource availability
   - Calculate earliest start = MAX(barrier, resource)
   - Call `place_duration_sql()`
   - Insert time slots
   - Update job stage instances
   - Update resource availability
   - Update barriers
8. Validate precedence
9. Return metrics

#### Calls
- `next_working_start(timestamptz)`
- `create_stage_availability_tracker()`
- `place_duration_sql(timestamptz, integer, integer)`
- `jsi_minutes(integer, integer)`
- `validate_job_scheduling_precedence()`

#### Used By
- `simple_scheduler_wrapper()`

---

### scheduler_append_jobs()

**Append-only scheduling for specific jobs**

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

#### Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `p_job_ids` | uuid[] | required | Array of job IDs to schedule |
| `p_only_if_unset` | boolean | `true` | Only schedule if `scheduled_start_at` is NULL |

#### Returns
Same format as `scheduler_reschedule_all_parallel_aware()`

#### Key Differences from Full Reschedule
- Only processes jobs in `p_job_ids` array
- Does NOT clear existing schedule data
- Respects existing resource availability
- Only validates affected jobs

#### Calls
- `next_working_start(timestamptz)`
- `create_stage_availability_tracker()`
- `place_duration_sql(timestamptz, integer, integer)`
- `jsi_minutes(integer, integer)`
- `validate_job_scheduling_precedence()`

#### Used By
- Proof approval trigger (`trigger_schedule_on_proof_approval()`)
- Manual job scheduling from UI

---

### cron_nightly_reschedule_with_carryforward()

**Nightly cron function for automated scheduling**

```sql
CREATE OR REPLACE FUNCTION public.cron_nightly_reschedule_with_carryforward()
RETURNS void
```

#### Parameters
None

#### Returns
`void`

#### Behavior
1. Calculate `time_aware_start = next_working_start(now())`
2. Log start time and calculated scheduling start
3. Carry forward overdue jobs: Update `production_jobs` SET `status = 'In Production'` WHERE `status = 'Approved'` AND `due_date < CURRENT_DATE`
4. Call `simple_scheduler_wrapper('reschedule_all', time_aware_start)`

#### Critical Feature
**Time-aware scheduling**: When run at 3 AM on a working day, schedules work from 8 AM the same day (not next day)

#### Calls
- `next_working_start(timestamptz)`
- `simple_scheduler_wrapper(text, timestamptz)`

#### Used By
- pg_cron job scheduled at `0 3 * * *`

---

## Helper Functions

### place_duration_sql()

**Places duration across working hours accounting for shifts and breaks**

```sql
CREATE OR REPLACE FUNCTION public.place_duration_sql(
  p_start_time timestamptz,
  p_duration_minutes integer,
  p_horizon_days integer DEFAULT 60
)
RETURNS TABLE(
  placement_success boolean,
  slots_created jsonb
)
```

#### Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `p_start_time` | timestamptz | required | Earliest possible start time |
| `p_duration_minutes` | integer | required | Total duration to place |
| `p_horizon_days` | integer | `60` | Maximum days ahead to search |

#### Returns
| Column | Type | Description |
|--------|------|-------------|
| `placement_success` | boolean | Whether placement succeeded |
| `slots_created` | jsonb | Array of time slot objects |

#### Slots Format
```typescript
[
  {
    date: "2025-09-30",
    start_time: "2025-09-30T08:00:00+00:00",
    end_time: "2025-09-30T10:30:00+00:00",
    duration_minutes: 150
  }
]
```

#### Features
- Handles lunch breaks (13:00-13:30)
- Respects shift boundaries (08:00-16:30)
- Skips weekends and holidays
- Can split work across multiple days
- Uses `next_working_start()` to find valid times
- Uses `shift_window_enhanced()` for shift boundaries

#### Calls
- `next_working_start(timestamptz)`
- `shift_window_enhanced(date)`
- `is_working_day(date)`

---

### next_working_start()

**Finds next valid working start time**

```sql
CREATE OR REPLACE FUNCTION public.next_working_start(
  p_start_time timestamptz
)
RETURNS timestamptz
```

#### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `p_start_time` | timestamptz | Time to start searching from |

#### Returns
`timestamptz` - Next valid working moment

#### Logic
1. Check if current time is within working hours on working day
2. If yes, return current time
3. If no, advance to next working day start (8:00 AM)
4. Skip weekends using `EXTRACT(DOW)`
5. Skip holidays using `public_holidays` table
6. Handle lunch break (if in break, return 13:30)

#### Calls
- `is_working_day(date)`
- `shift_window_enhanced(date)`

---

### is_working_day()

**Checks if date is a working day**

```sql
CREATE OR REPLACE FUNCTION public.is_working_day(
  p_check_date date
)
RETURNS boolean
```

#### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `p_check_date` | date | Date to check |

#### Returns
`boolean` - `true` if working day, `false` if weekend or holiday

#### Logic
```sql
-- Exclude Saturday (6) and Sunday (0)
IF EXTRACT(DOW FROM p_check_date) IN (0, 6) THEN
  RETURN false;
END IF;

-- Exclude active public holidays
IF EXISTS (
  SELECT 1 FROM public_holidays 
  WHERE date = p_check_date 
    AND is_active = true
) THEN
  RETURN false;
END IF;

RETURN true;
```

---

### shift_window_enhanced()

**Gets shift start/end times for a date**

```sql
CREATE OR REPLACE FUNCTION public.shift_window_enhanced(
  p_check_date date
)
RETURNS TABLE(
  win_start timestamptz,
  win_end timestamptz
)
```

#### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `p_check_date` | date | Date to get shift times for |

#### Returns
| Column | Type | Description |
|--------|------|-------------|
| `win_start` | timestamptz | Shift start time with timezone |
| `win_end` | timestamptz | Shift end time with timezone |

#### Default Behavior
If no custom shift found in `shift_schedules` table:
- Start: 08:00:00 (8 AM)
- End: 16:30:00 (4:30 PM)
- Timezone: Africa/Johannesburg (SAST/UTC+2)

---

### jsi_minutes()

**Gets effective duration minutes**

```sql
CREATE OR REPLACE FUNCTION public.jsi_minutes(
  p_scheduled_minutes integer,
  p_estimated_minutes integer
)
RETURNS integer
```

#### Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `p_scheduled_minutes` | integer | Manually scheduled duration |
| `p_estimated_minutes` | integer | System-estimated duration |

#### Returns
`integer` - Effective duration in minutes

#### Logic
```sql
RETURN COALESCE(p_scheduled_minutes, p_estimated_minutes, 60);
```

Priority: scheduled > estimated > 60 (default)

---

### validate_job_scheduling_precedence()

**Validates that stages are scheduled in correct order**

```sql
CREATE OR REPLACE FUNCTION public.validate_job_scheduling_precedence()
RETURNS TABLE(
  job_id uuid,
  wo_no text,
  stage_id uuid,
  stage_name text,
  violation_type text,
  details text
)
```

#### Parameters
None

#### Returns
Array of violation records

#### Violation Types
- `out_of_order`: Stage scheduled before earlier stage
- `missing_dependency`: Dependent stage scheduled but dependency not scheduled
- `part_barrier_violation`: Combined stage scheduled before parts ready

---

### create_stage_availability_tracker()

**Creates temporary _stage_tails table**

```sql
CREATE OR REPLACE FUNCTION public.create_stage_availability_tracker()
RETURNS void
```

#### Parameters
None

#### Returns
`void`

#### Creates
```sql
CREATE TEMP TABLE IF NOT EXISTS _stage_tails (
  stage_id uuid PRIMARY KEY,
  next_available_time timestamptz NOT NULL
);
```

#### Purpose
Track when each production stage resource becomes available for next job

---

## Trigger Functions

### trigger_schedule_on_proof_approval()

**Automatically schedules job when proof is manually approved**

```sql
CREATE OR REPLACE FUNCTION public.trigger_schedule_on_proof_approval()
RETURNS trigger
```

#### Trigger Event
`AFTER UPDATE OF proof_approved_manually_at ON job_stage_instances`

#### Behavior
1. Check if stage is a Proof stage (name ILIKE '%proof%')
2. Check if `proof_approved_manually_at` transitioned from NULL to NOT NULL
3. Call `scheduler_append_jobs(ARRAY[NEW.job_id], true)`
4. Log action to `batch_allocation_logs`

---

## Function Dependencies Graph

```
UI / Cron
    │
    ├─> simple_scheduler_wrapper(p_mode, p_start_from)
    │       │
    │       └─> scheduler_reschedule_all_parallel_aware(p_start_from)
    │               │
    │               ├─> next_working_start(timestamptz)
    │               ├─> create_stage_availability_tracker()
    │               ├─> jsi_minutes(integer, integer)
    │               ├─> place_duration_sql(timestamptz, integer, integer)
    │               │       │
    │               │       ├─> next_working_start(timestamptz)
    │               │       ├─> is_working_day(date)
    │               │       └─> shift_window_enhanced(date)
    │               │
    │               └─> validate_job_scheduling_precedence()
    │
    └─> cron_nightly_reschedule_with_carryforward()
            │
            ├─> next_working_start(now())
            └─> simple_scheduler_wrapper('reschedule_all', time_aware_start)
```

---

## Table Dependencies

### Functions Read From
- `production_jobs` - Job details, approval times
- `job_stage_instances` - Stage status, order, configuration
- `production_stages` - Stage definitions, names
- `stage_time_slots` - Existing schedule data
- `public_holidays` - Non-working days
- `shift_schedules` - Custom shift times
- `categories` - Job categorization
- `category_production_stages` - Stage workflows

### Functions Write To
- `stage_time_slots` - Time slot allocations
- `job_stage_instances` - Schedule times and status
- `batch_allocation_logs` - Scheduling events

### Temporary Tables Created
- `_stage_tails` - Resource availability tracking (per-session)

---

## Performance Characteristics

### simple_scheduler_wrapper()
- **Timeout**: 120s (with 300s idle timeout)
- **Locking**: Advisory lock prevents concurrent runs
- **Typical duration**: < 5s for UI calls, < 30s for nightly cron

### scheduler_reschedule_all_parallel_aware()
- **Jobs processed**: 50-100 typical, up to 300 tested
- **Stages processed**: 300-500 typical
- **Memory**: Temp table + result sets (~5-10 MB)
- **Database load**: Single transaction, minimal lock contention

### place_duration_sql()
- **Horizon**: 60 working days
- **Typical iterations**: 1-3 days per stage
- **Performance**: O(days × slots_per_day)

---

**END OF FUNCTION SIGNATURES**
**Last Updated: September 30, 2025**
