# Scheduler Schema Snapshot - October 24-25, 2025

## Purpose
This document captures the **exact database schema** that the working scheduler functions expect. Use this as the single source of truth when validating or restoring scheduler functionality.

## Critical Tables and Columns Used by Scheduler

### 1. job_stage_instances

**Columns referenced by scheduler:**
- `id` (uuid, PRIMARY KEY)
- `job_id` (uuid) - References production_jobs
- `production_stage_id` (uuid) - References production_stages
- `status` (text) - **NOT** `stage_status` (this was a breaking change)
- `stage_order` (integer) - Sequential order within job
- `part_assignment` (text) - Values: 'cover', 'text', 'main', 'both', NULL
- `scheduled_start_at` (timestamptz)
- `scheduled_end_at` (timestamptz)
- `scheduled_minutes` (integer)
- `schedule_status` (text) - Values: 'scheduled', 'unscheduled', 'expired', 'auto_held'
- `estimated_duration_minutes` (integer)
- `remaining_minutes` (integer)
- `completion_percentage` (integer)
- `updated_at` (timestamptz)

**Critical Dependencies:**
- JOIN with `production_stages` via `production_stage_id`
- JOIN with `production_jobs` via `job_id`

### 2. production_stages

**Columns referenced by scheduler:**
- `id` (uuid, PRIMARY KEY)
- `name` (text) - **CRITICAL**: No `stage_name` column exists in `job_stage_instances`
- `allow_gap_filling` (boolean) - Enables Phase 2 gap-filling for this stage

**How it's used:**
```sql
-- Correct JOIN pattern (October 24 working code)
SELECT ps.name as stage_name
FROM job_stage_instances jsi
JOIN production_stages ps ON ps.id = jsi.production_stage_id
```

### 3. stage_time_slots

**Columns referenced by scheduler:**
- `id` (uuid, PRIMARY KEY)
- `production_stage_id` (uuid)
- `stage_instance_id` (uuid) - References job_stage_instances.id
- `job_id` (uuid)
- `job_table_name` (text)
- `date` (date)
- `slot_start_time` (timestamptz)
- `slot_end_time` (timestamptz)
- `duration_minutes` (integer)
- `is_completed` (boolean)

**Unique Constraint:**
- `(production_stage_id, slot_start_time)` - Prevents double-booking

### 4. production_jobs

**Columns referenced by scheduler:**
- `id` (uuid, PRIMARY KEY)
- `wo_no` (text) - Work Order Number (for logging)
- `proof_approved_at` (timestamptz) - FIFO ordering key
- `category_id` (uuid)
- `status` (text)
- `due_date` (date)

### 5. schedule_gap_fills

**Audit table for gap-filling:**
- `id` (uuid, PRIMARY KEY)
- `job_id` (uuid)
- `stage_instance_id` (uuid)
- `production_stage_id` (uuid)
- `original_scheduled_start` (timestamptz)
- `gap_filled_start` (timestamptz)
- `days_saved` (numeric)
- `minutes_saved` (integer)
- `scheduler_run_type` (text)

### 6. _stage_tails (temporary table)

**Created during scheduler run:**
```sql
CREATE TEMP TABLE IF NOT EXISTS _stage_tails(
  stage_id uuid PRIMARY KEY,
  next_available_time timestamptz NOT NULL
);
```

## Helper Functions Expected by Scheduler

### jsi_minutes()
```sql
public.jsi_minutes(
  scheduled_minutes integer,
  estimated_duration_minutes integer,
  remaining_minutes integer,
  completion_percentage integer
) RETURNS integer
```

### next_working_start()
```sql
public.next_working_start(
  p_time timestamptz
) RETURNS timestamptz
```

### is_working_day()
```sql
public.is_working_day(
  p_date date
) RETURNS boolean
```

### shift_window_enhanced()
```sql
public.shift_window_enhanced(
  p_start_date date,
  p_end_date date DEFAULT NULL
) RETURNS TABLE(
  start_time timestamptz,
  end_time timestamptz,
  has_lunch_break boolean,
  lunch_start timestamptz,
  lunch_end timestamptz,
  win_start timestamptz,
  win_end timestamptz
)
```

### create_stage_availability_tracker()
```sql
public.create_stage_availability_tracker() RETURNS void
```

## Common Breaking Changes to Avoid

### ❌ Wrong Column References
```sql
-- WRONG (breaks scheduler)
SELECT jsi.stage_status  -- Column doesn't exist!
SELECT jsi.stage_name    -- Column doesn't exist!

-- CORRECT (October 24 working code)
SELECT jsi.status
SELECT ps.name as stage_name
FROM job_stage_instances jsi
JOIN production_stages ps ON ps.id = jsi.production_stage_id
```

### ❌ Missing JOINs
```sql
-- WRONG (breaks scheduler)
SELECT stage_name FROM job_stage_instances

-- CORRECT
SELECT ps.name as stage_name
FROM job_stage_instances jsi
JOIN production_stages ps ON ps.id = jsi.production_stage_id
```

### ❌ Wrong Status Column
```sql
-- WRONG
WHERE jsi.stage_status IN ('pending', 'active')

-- CORRECT
WHERE jsi.status IN ('pending', 'active')
```

## Part-Aware Filtering Logic

The scheduler uses **part_assignment** for parallel scheduling:

- `'cover'` - Cover-only stages
- `'text'` - Text-only stages
- `'both'` - Convergence points (waits for both cover AND text)
- `'main'` or `NULL` - Main flow stages

**Predecessor Check Pattern (from October 24 working code):**
```sql
-- If current stage is 'both', wait for everything
r_stage.part_assignment = 'both'
OR
-- If current stage is 'text', only wait for text and both stages
(COALESCE(r_stage.part_assignment, 'main') = 'text' 
 AND jsi2.part_assignment IN ('text', 'both'))
OR
-- If current stage is 'cover', only wait for cover and both stages
(COALESCE(r_stage.part_assignment, 'main') = 'cover' 
 AND jsi2.part_assignment IN ('cover', 'both'))
OR
-- If current stage is 'main' (or NULL), wait for main and both stages
(COALESCE(r_stage.part_assignment, 'main') = 'main' 
 AND COALESCE(jsi2.part_assignment, 'main') IN ('main', 'both'))
```

## Validation Checklist

Before deploying any SQL changes:

- [ ] Query `information_schema.columns` for all tables
- [ ] Verify `job_stage_instances.status` exists (NOT `stage_status`)
- [ ] Verify JOINs to `production_stages` for stage names
- [ ] Test in transaction with `ROLLBACK`
- [ ] Compare against October 24-25 working code
- [ ] Run regression tests (e.g., D427310 gap-filling)

## Schema Query for Validation

```sql
-- Run this BEFORE any scheduler SQL changes
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN (
  'job_stage_instances',
  'production_stages',
  'stage_time_slots',
  'production_jobs',
  'schedule_gap_fills'
)
ORDER BY table_name, ordinal_position;
```

## Recovery Procedure

If scheduler breaks:

1. **Stop all scheduler operations**
2. **Query current schema** (use query above)
3. **Compare to this document**
4. **Restore functions from** `docs/restore_oct_24_working_scheduler*.sql`
5. **Test with D427310** (UV Varnishing gap-filling test case)
6. **Validate nightly cron** completes successfully

## Last Known Working State

**Date**: October 24-25, 2025 03:00 AM  
**Source**: DB Dump files in `docs/db/`  
**Verified Behavior**: Gap-filling working, no column errors, 8-day gaps eliminated
