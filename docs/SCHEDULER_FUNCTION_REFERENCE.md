# Scheduler Function Reference

**CRITICAL REFERENCE - DO NOT MODIFY THESE SIGNATURES**

## Core Functions

### `simple_scheduler_wrapper(p_mode text)`
```sql
-- Entry point for all scheduling operations
-- Routes to scheduler_resource_fill_optimized() for all modes
-- Returns: {scheduled_count: integer, wrote_slots: integer, success: boolean}
```

### `scheduler_resource_fill_optimized()`
```sql
-- Main scheduling algorithm
-- Uses resource-availability-first strategy
-- Creates temporary _stage_tails table
-- Processes jobs in FIFO order by proof_approved_at
-- Returns: table with scheduling results
```

### `place_duration_sql(start_time timestamptz, duration_minutes integer)`
```sql
-- Places duration across working hours
-- Handles lunch breaks and shift boundaries
-- Returns: jsonb array of time slots
-- Format: [{"date": "2024-01-01", "start_time": "...", "end_time": "...", "duration_minutes": N}]
```

### `next_working_start(start_time timestamptz)`
```sql
-- Finds next valid working start time
-- Accounts for weekends, holidays, shift schedules
-- Returns: timestamptz of next working moment
```

### `is_working_day(check_date date)`
```sql
-- Checks if date is a working day
-- Excludes weekends (Saturday/Sunday)
-- Excludes active public holidays
-- Returns: boolean
```

### `shift_window_enhanced(check_date date)`
```sql
-- Gets shift start/end times for a date
-- Looks up from shift_schedules table
-- Returns: (win_start timestamptz, win_end timestamptz)
```

### `jsi_minutes(scheduled_minutes integer, estimated_minutes integer)`
```sql
-- Gets effective duration minutes
-- Prioritizes scheduled_minutes over estimated_minutes
-- Returns: integer (duration in minutes)
```

## Data Structures

### Temporary Table: `_stage_tails`
```sql
CREATE TEMP TABLE _stage_tails (
  stage_id uuid PRIMARY KEY,
  next_available_time timestamptz NOT NULL
);
-- Tracks when each production stage becomes available
-- Updated after each job scheduling
```

### Key Tables
- `job_stage_instances`: Stage scheduling data
- `stage_time_slots`: Time slot allocations
- `shift_schedules`: Working hours by day of week
- `public_holidays`: Non-working days
- `production_stages`: Stage definitions

## Critical Filters

### Job Selection Criteria
```sql
-- Only approved jobs
WHERE pj.proof_approved_at IS NOT NULL

-- Only pending stages  
WHERE COALESCE(jsi.status, 'pending') = 'pending'

-- Exclude special stages
WHERE ps.name NOT ILIKE '%dtp%'
  AND ps.name NOT ILIKE '%proof%'
  AND ps.name NOT ILIKE '%batch%allocation%'
```

### Ordering Logic
```sql
ORDER BY 
  pj.proof_approved_at ASC,  -- FIFO by approval time
  jsi.stage_order ASC        -- Sequential stage order within job
```

## Return Formats

### Scheduler Response
```json
{
  "scheduled_count": 145,
  "wrote_slots": 287,
  "success": true,
  "mode": "reschedule_all"
}
```

### Time Slot Format
```json
[
  {
    "date": "2024-01-15",
    "start_time": "2024-01-15T08:00:00+00:00",
    "end_time": "2024-01-15T10:30:00+00:00", 
    "duration_minutes": 150
  }
]
```

---
**NEVER MODIFY THESE SIGNATURES WITHOUT FULL SYSTEM BACKUP**