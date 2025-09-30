# Scheduler System Restoration Guide

**EMERGENCY RECOVERY PROCEDURES - AS OF SEPTEMBER 30, 2025**

Use this guide for complete restoration of the production scheduler system from scratch or after corruption.

---

## Quick Recovery Checklist

- [ ] 1. Stop all cron jobs
- [ ] 2. Create full database backup
- [ ] 3. Restore core helper functions
- [ ] 4. Restore main scheduler function
- [ ] 5. Restore wrapper function
- [ ] 6. Restore cron function
- [ ] 7. Restore triggers
- [ ] 8. Recreate cron schedule
- [ ] 9. Run verification tests
- [ ] 10. Monitor first execution

---

## Pre-Restoration Steps

### 1. Stop Active Scheduling

```sql
-- Disable cron jobs
SELECT cron.unschedule('nightly-reschedule-consolidated');

-- Check for running schedulers
SELECT pid, query, state, query_start
FROM pg_stat_activity
WHERE query LIKE '%scheduler%'
  AND state = 'active';

-- If needed, terminate active schedulers
-- SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE ...;
```

### 2. Create Backup

```sql
-- Export current function definitions
SELECT 
  proname,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname IN (
  'simple_scheduler_wrapper',
  'scheduler_reschedule_all_parallel_aware',
  'scheduler_append_jobs',
  'cron_nightly_reschedule_with_carryforward',
  'place_duration_sql',
  'next_working_start',
  'is_working_day',
  'shift_window_enhanced',
  'jsi_minutes',
  'validate_job_scheduling_precedence',
  'create_stage_availability_tracker'
);

-- Backup schedule data
CREATE TABLE backup_stage_time_slots_YYYYMMDD AS 
SELECT * FROM stage_time_slots;

CREATE TABLE backup_job_stage_instances_YYYYMMDD AS
SELECT * FROM job_stage_instances;
```

---

## Core Function Restoration

### Step 1: Restore Helper Functions

#### A. is_working_day()

```sql
CREATE OR REPLACE FUNCTION public.is_working_day(p_check_date date)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $function$
BEGIN
  -- Exclude weekends (Saturday = 6, Sunday = 0)
  IF EXTRACT(DOW FROM p_check_date) IN (0, 6) THEN
    RETURN false;
  END IF;
  
  -- Exclude active public holidays
  IF EXISTS (
    SELECT 1 FROM public_holidays 
    WHERE date = p_check_date 
      AND COALESCE(is_active, true) = true
  ) THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$function$;
```

#### B. shift_window_enhanced()

```sql
CREATE OR REPLACE FUNCTION public.shift_window_enhanced(p_check_date date)
RETURNS TABLE(win_start timestamptz, win_end timestamptz)
LANGUAGE plpgsql
STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    (p_check_date + TIME '08:00:00') AT TIME ZONE 'Africa/Johannesburg' AS win_start,
    (p_check_date + TIME '16:30:00') AT TIME ZONE 'Africa/Johannesburg' AS win_end;
END;
$function$;
```

#### C. next_working_start()

```sql
CREATE OR REPLACE FUNCTION public.next_working_start(p_start_time timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  check_date date;
  check_time time;
  shift_start timestamptz;
  shift_end timestamptz;
  lunch_start time := '13:00:00';
  lunch_end time := '13:30:00';
BEGIN
  check_date := (p_start_time AT TIME ZONE 'Africa/Johannesburg')::date;
  check_time := (p_start_time AT TIME ZONE 'Africa/Johannesburg')::time;
  
  -- Loop until we find a valid working moment
  LOOP
    -- Check if current date is working day
    IF public.is_working_day(check_date) THEN
      SELECT win_start, win_end INTO shift_start, shift_end
      FROM public.shift_window_enhanced(check_date);
      
      -- If current time is within working hours
      IF p_start_time >= shift_start AND p_start_time < shift_end THEN
        -- Check if in lunch break
        IF check_time >= lunch_start AND check_time < lunch_end THEN
          RETURN (check_date + lunch_end) AT TIME ZONE 'Africa/Johannesburg';
        ELSE
          RETURN p_start_time;
        END IF;
      -- If before work starts, return shift start
      ELSIF p_start_time < shift_start THEN
        RETURN shift_start;
      END IF;
    END IF;
    
    -- Move to next day at shift start
    check_date := check_date + 1;
    SELECT win_start INTO shift_start
    FROM public.shift_window_enhanced(check_date);
    p_start_time := shift_start;
    check_time := '08:00:00';
  END LOOP;
END;
$function$;
```

#### D. jsi_minutes()

```sql
CREATE OR REPLACE FUNCTION public.jsi_minutes(
  p_scheduled_minutes integer,
  p_estimated_minutes integer
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $function$
BEGIN
  RETURN COALESCE(p_scheduled_minutes, p_estimated_minutes, 60);
END;
$function$;
```

#### E. create_stage_availability_tracker()

```sql
CREATE OR REPLACE FUNCTION public.create_stage_availability_tracker()
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _stage_tails (
    stage_id uuid PRIMARY KEY,
    next_available_time timestamptz NOT NULL
  );
END;
$function$;
```

### Step 2: Restore place_duration_sql()

**CRITICAL**: This function is complex. Restore from backup or see SCHEDULER_WORKING_STATE_MASTER.md for complete source.

```sql
-- Verify the function exists and has correct signature
SELECT 
  proname,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as returns
FROM pg_proc
WHERE proname = 'place_duration_sql';

-- Expected output:
-- proname: place_duration_sql
-- arguments: p_start_time timestamp with time zone, p_duration_minutes integer, p_horizon_days integer DEFAULT 60
-- returns: TABLE(placement_success boolean, slots_created jsonb)
```

### Step 3: Restore validate_job_scheduling_precedence()

```sql
-- Verify the function exists
SELECT proname FROM pg_proc WHERE proname = 'validate_job_scheduling_precedence';
```

### Step 4: Restore Main Scheduler Function

```sql
-- See complete source in SCHEDULER_WORKING_STATE_MASTER.md
-- Function: scheduler_reschedule_all_parallel_aware(p_start_from timestamptz DEFAULT NULL)
-- This is the most complex function - use exact source from working backup
```

**Verification after restore:**
```sql
-- Check signature
SELECT 
  proname,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as returns
FROM pg_proc
WHERE proname = 'scheduler_reschedule_all_parallel_aware';

-- Expected:
-- arguments: p_start_from timestamp with time zone DEFAULT NULL
-- returns: TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
```

### Step 5: Restore Wrapper Function

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

### Step 6: Restore Cron Function

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

### Step 7: Restore Triggers

```sql
-- Trigger for proof approval scheduling
CREATE OR REPLACE FUNCTION public.trigger_schedule_on_proof_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  is_proof boolean;
  result record;
BEGIN
  IF NEW.proof_approved_manually_at IS NOT NULL AND (OLD.proof_approved_manually_at IS NULL) THEN
    SELECT ps.name ILIKE '%proof%' INTO is_proof
    FROM public.production_stages ps
    WHERE ps.id = NEW.production_stage_id;

    IF COALESCE(is_proof, false) THEN
      SELECT * INTO result FROM public.scheduler_append_jobs(
        ARRAY[NEW.job_id]::uuid[],
        true
      );
      
      INSERT INTO public.batch_allocation_logs (job_id, action, details)
      VALUES (NEW.job_id, 'proof_approval_trigger_append', 'Appended job to schedule after proof approval');
      
      RAISE NOTICE 'Proof approval trigger fired for job % - appended to schedule', NEW.job_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_schedule_on_proof_approval ON job_stage_instances;
CREATE TRIGGER trg_schedule_on_proof_approval 
  AFTER UPDATE OF proof_approved_manually_at ON public.job_stage_instances 
  FOR EACH ROW 
  EXECUTE FUNCTION trigger_schedule_on_proof_approval();
```

---

## Cron Job Restoration

### Step 8: Recreate Cron Schedule

```sql
-- Remove old cron job if exists
SELECT cron.unschedule('nightly-reschedule-consolidated');

-- Create new cron job
SELECT cron.schedule(
  'nightly-reschedule-consolidated',
  '0 3 * * *',  -- Every day at 3:00 AM SAST
  $$
  SELECT public.cron_nightly_reschedule_with_carryforward();
  $$
);

-- Verify cron job created
SELECT * FROM cron.job WHERE jobname = 'nightly-reschedule-consolidated';

-- Expected output:
-- jobname: nightly-reschedule-consolidated
-- schedule: 0 3 * * *
-- command: SELECT public.cron_nightly_reschedule_with_carryforward();
-- active: true
```

---

## Verification Tests

### Test 1: Helper Functions Work

```sql
-- Test is_working_day
SELECT public.is_working_day(CURRENT_DATE);  -- Should return true/false based on today

-- Test next_working_start
SELECT public.next_working_start(now());  -- Should return next valid working moment

-- Test jsi_minutes
SELECT public.jsi_minutes(120, 90);  -- Should return 120
SELECT public.jsi_minutes(NULL, 90);  -- Should return 90
SELECT public.jsi_minutes(NULL, NULL);  -- Should return 60
```

### Test 2: Manual Reschedule Works

```sql
-- Clear test data (CAREFUL - only do this on test/dev)
DELETE FROM stage_time_slots WHERE is_completed = false;
UPDATE job_stage_instances SET 
  scheduled_start_at = NULL,
  scheduled_end_at = NULL,
  scheduled_minutes = NULL,
  schedule_status = NULL
WHERE status NOT IN ('completed', 'active');

-- Run manual reschedule
SELECT public.simple_scheduler_wrapper('reschedule_all');

-- Verify results
SELECT 
  COUNT(*) as total_slots,
  COUNT(DISTINCT job_id) as unique_jobs,
  MIN(slot_start_time) as earliest,
  MAX(slot_end_time) as latest
FROM stage_time_slots
WHERE is_completed = false;
```

### Test 3: Time-Aware Scheduling Works

```sql
-- Simulate 3 AM Monday cron
DO $$
DECLARE
  monday_3am timestamptz;
  result_start timestamptz;
BEGIN
  -- Get next Monday at 3 AM
  monday_3am := date_trunc('week', CURRENT_DATE + interval '7 days') + interval '3 hours';
  monday_3am := monday_3am AT TIME ZONE 'Africa/Johannesburg';
  
  -- Calculate where scheduler would start
  result_start := public.next_working_start(monday_3am);
  
  RAISE NOTICE 'If cron runs at %, scheduler would start at %', monday_3am, result_start;
  
  -- Expected: result_start should be Monday 8 AM (same day)
  IF result_start::date = monday_3am::date THEN
    RAISE NOTICE '✓ PASS: Time-aware scheduling working (schedules same day)';
  ELSE
    RAISE NOTICE '✗ FAIL: Time-aware scheduling broken (schedules next day)';
  END IF;
END $$;
```

### Test 4: Append Jobs Works

```sql
-- Get a pending job
SELECT id FROM production_jobs 
WHERE status = 'In Production' 
  AND proof_approved_at IS NOT NULL
LIMIT 1;

-- Test append (use actual job ID from above)
SELECT public.scheduler_append_jobs(ARRAY['<job-id-here>']::uuid[]);
```

### Test 5: Triggers Work

```sql
-- Find a proof stage
SELECT id FROM job_stage_instances jsi
JOIN production_stages ps ON ps.id = jsi.production_stage_id
WHERE ps.name ILIKE '%proof%'
  AND jsi.proof_approved_manually_at IS NULL
LIMIT 1;

-- Manually approve proof (use actual ID from above)
UPDATE job_stage_instances 
SET proof_approved_manually_at = now()
WHERE id = '<stage-instance-id-here>';

-- Check batch_allocation_logs for trigger execution
SELECT * FROM batch_allocation_logs 
WHERE action = 'proof_approval_trigger_append'
ORDER BY created_at DESC 
LIMIT 5;
```

### Test 6: Cron Job Executes

```sql
-- Manually trigger cron function
SELECT public.cron_nightly_reschedule_with_carryforward();

-- Check execution in cron history
SELECT * FROM cron.job_run_details 
WHERE jobname = 'nightly-reschedule-consolidated'
ORDER BY start_time DESC 
LIMIT 5;
```

---

## Common Restoration Issues

### Issue 1: Function Dependencies

**Problem**: Functions fail to restore due to dependency order

**Solution**: Restore in this exact order:
1. `is_working_day()`
2. `shift_window_enhanced()`
3. `next_working_start()`
4. `jsi_minutes()`
5. `create_stage_availability_tracker()`
6. `place_duration_sql()`
7. `validate_job_scheduling_precedence()`
8. `scheduler_reschedule_all_parallel_aware()`
9. `scheduler_append_jobs()`
10. `simple_scheduler_wrapper()`
11. `cron_nightly_reschedule_with_carryforward()`
12. Trigger functions

### Issue 2: Missing Table Columns

**Problem**: Functions reference columns that don't exist

**Check Required Columns:**
```sql
-- job_stage_instances required columns
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'job_stage_instances'
  AND column_name IN (
    'proof_approved_manually_at',
    'scheduled_start_at',
    'scheduled_end_at',
    'scheduled_minutes',
    'schedule_status',
    'part_assignment',
    'dependency_group',
    'stage_order',
    'estimated_duration_minutes'
  )
ORDER BY column_name;

-- production_jobs required columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'production_jobs'
  AND column_name IN (
    'proof_approved_at',
    'status',
    'due_date'
  );
```

### Issue 3: Permission Issues

**Problem**: Functions fail with permission errors

**Solution:**
```sql
-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.simple_scheduler_wrapper TO service_role;
GRANT EXECUTE ON FUNCTION public.scheduler_reschedule_all_parallel_aware TO service_role;
GRANT EXECUTE ON FUNCTION public.cron_nightly_reschedule_with_carryforward TO postgres;

-- Verify SECURITY DEFINER is set
SELECT proname, prosecdef 
FROM pg_proc
WHERE proname IN (
  'simple_scheduler_wrapper',
  'cron_nightly_reschedule_with_carryforward'
);
-- prosecdef should be 't' (true)
```

### Issue 4: Timezone Issues

**Problem**: Times scheduled in wrong timezone

**Verify Timezone Settings:**
```sql
SHOW timezone;  -- Should be 'UTC' or 'Africa/Johannesburg'

-- Test timezone conversion
SELECT 
  now() as utc_time,
  now() AT TIME ZONE 'Africa/Johannesburg' as sast_time;
```

---

## Rollback Procedures

### If Restoration Fails

```sql
-- 1. Restore old functions from backup
-- (Use pg_dump output from pre-restoration backup)

-- 2. Restore schedule data if needed
INSERT INTO stage_time_slots
SELECT * FROM backup_stage_time_slots_YYYYMMDD
ON CONFLICT (id) DO NOTHING;

INSERT INTO job_stage_instances
SELECT * FROM backup_job_stage_instances_YYYYMMDD
ON CONFLICT (id) DO UPDATE SET
  scheduled_start_at = EXCLUDED.scheduled_start_at,
  scheduled_end_at = EXCLUDED.scheduled_end_at,
  scheduled_minutes = EXCLUDED.scheduled_minutes,
  schedule_status = EXCLUDED.schedule_status;

-- 3. Re-enable old cron job
SELECT cron.schedule(
  'nightly-reschedule-consolidated',
  '0 3 * * *',
  $$ SELECT public.cron_nightly_reschedule_with_carryforward(); $$
);
```

---

## Post-Restoration Monitoring

### Day 1: Monitor First Cron Execution

```sql
-- Check cron ran successfully
SELECT 
  jobname,
  runid,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobname = 'nightly-reschedule-consolidated'
  AND start_time >= CURRENT_DATE
ORDER BY start_time DESC;
```

### Week 1: Verify Daily Operation

```sql
-- Check daily scheduling success
SELECT 
  DATE(start_time) as run_date,
  COUNT(*) as executions,
  COUNT(*) FILTER (WHERE status = 'succeeded') as successes,
  COUNT(*) FILTER (WHERE status = 'failed') as failures,
  AVG(EXTRACT(EPOCH FROM (end_time - start_time))) as avg_duration_seconds
FROM cron.job_run_details
WHERE jobname = 'nightly-reschedule-consolidated'
  AND start_time >= CURRENT_DATE - interval '7 days'
GROUP BY DATE(start_time)
ORDER BY run_date DESC;
```

### Check Schedule Quality

```sql
-- Verify jobs are scheduled correctly
SELECT 
  COUNT(DISTINCT jsi.job_id) as jobs_with_schedules,
  COUNT(*) as total_scheduled_stages,
  MIN(jsi.scheduled_start_at) as earliest_schedule,
  MAX(jsi.scheduled_end_at) as latest_schedule
FROM job_stage_instances jsi
WHERE jsi.schedule_status = 'scheduled'
  AND jsi.status NOT IN ('completed', 'active');
```

---

## Success Criteria

✅ **Restoration is successful when:**

1. All helper functions restored and pass tests
2. `simple_scheduler_wrapper()` executes without errors
3. Manual reschedule creates time slots correctly
4. Time-aware scheduling works (3 AM → 8 AM same day)
5. Proof approval trigger schedules jobs
6. Cron job executes nightly at 3 AM
7. No precedence violations in scheduled jobs
8. Schedule data matches expected patterns
9. Performance metrics within normal ranges
10. No error logs or exceptions

---

**END OF RESTORATION GUIDE**
**Last Updated: September 30, 2025**
**Keep with SCHEDULER_WORKING_STATE_MASTER.md**
