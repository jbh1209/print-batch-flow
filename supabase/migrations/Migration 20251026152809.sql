
-- ====================================================================
-- PHASE 1: Restore backward-compatible wrapper for global scheduling
-- ====================================================================

-- Restore the old wrapper signature that was working before divisions
-- This allows the edge function to call with p_mode for backward compatibility
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(
  p_mode text DEFAULT 'reschedule_all',
  p_start_from timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
  -- Call the division-aware function with NULL division (global mode)
  -- This restores the working behavior from yesterday morning
  RETURN public.scheduler_reschedule_all_parallel_aware(NULL::text);
END;
$$;

COMMENT ON FUNCTION public.simple_scheduler_wrapper(text, timestamptz) IS 
'Backward-compatible wrapper for global scheduling (no division filter). Calls scheduler_reschedule_all_parallel_aware with NULL division.';

-- ====================================================================
-- PHASE 2: Update scheduler to support optional division filtering
-- ====================================================================

-- Drop and recreate the function to change its signature properly
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(text);

-- Update the parallel-aware scheduler to scope cleanup operations by division
-- This makes division optional: NULL = global (all divisions), string = scoped to that division
CREATE FUNCTION public.scheduler_reschedule_all_parallel_aware(p_division text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  stage_record RECORD;
  job_record RECORD;
  base_time timestamptz;
  slot_start timestamptz;
  slot_end timestamptz;
  day_start timestamptz;
  day_end timestamptz;
  lunch_start timestamptz;
  lunch_end timestamptz;
  working_date date;
  total_updated integer := 0;
  total_slots integer := 0;
  violation_list text[] := '{}';
  dtp_stages_excluded integer := 0;
  dtp_slots_deleted integer := 0;
  cleared_stages integer := 0;
  cleared_slots integer := 0;
BEGIN
  -- Advisory lock to prevent concurrent scheduling
  PERFORM pg_advisory_xact_lock(1, 42);
  
  RAISE NOTICE '=== SCHEDULER START: Division=%, Time=%===', COALESCE(p_division, 'ALL'), now();
  
  -- CRITICAL: Clean up any existing DTP/Proof slots first (division-scoped)
  WITH deleted_slots AS (
    DELETE FROM stage_time_slots sts
    USING production_stages ps, production_jobs pj
    LEFT JOIN stage_groups sg ON sg.id = ps.stage_group_id
    WHERE sts.production_stage_id = ps.id
      AND sts.job_id = pj.id
      AND sts.job_table_name = 'production_jobs'
      AND COALESCE(sts.is_completed, false) = false
      AND (
        LOWER(COALESCE(sg.name, '')) = 'dtp'
        OR LOWER(ps.name) LIKE '%proof%'
      )
      AND (p_division IS NULL OR pj.division = p_division)
    RETURNING sts.id
  )
  SELECT COUNT(*) INTO dtp_slots_deleted FROM deleted_slots;
  
  RAISE NOTICE 'Pre-cleanup: Deleted % DTP/Proof slots (division: %)', dtp_slots_deleted, COALESCE(p_division, 'ALL');
  
  -- Start scheduling from next working day at 8 AM
  working_date := CURRENT_DATE + interval '1 day';
  
  -- Find next working day (skip weekends and holidays)
  WHILE EXTRACT(dow FROM working_date) IN (0, 6) OR EXISTS (
    SELECT 1 FROM public_holidays WHERE date = working_date::date AND is_active = true
  ) LOOP
    working_date := working_date + interval '1 day';
  END LOOP;
  
  base_time := working_date + time '08:00:00';
  
  RAISE NOTICE 'Base scheduling time: % (next working day)', base_time;
  
  -- Clear all existing schedules for pending stages (DIVISION-SCOPED)
  WITH cleared AS (
    UPDATE job_stage_instances jsi
    SET 
      scheduled_start_at = NULL,
      scheduled_end_at = NULL,
      scheduled_minutes = NULL,
      schedule_status = NULL,
      updated_at = now()
    FROM production_jobs pj
    WHERE jsi.job_table_name = 'production_jobs'
      AND jsi.status = 'pending'
      AND pj.id = jsi.job_id
      AND (p_division IS NULL OR pj.division = p_division)
    RETURNING jsi.id
  )
  SELECT COUNT(*) INTO cleared_stages FROM cleared;
  
  RAISE NOTICE 'Cleared schedules for % pending stages (division: %)', cleared_stages, COALESCE(p_division, 'ALL');
  
  -- Clear all existing non-completed time slots (DIVISION-SCOPED)
  WITH deleted AS (
    DELETE FROM stage_time_slots sts
    USING production_jobs pj
    WHERE COALESCE(sts.is_completed, false) = false
      AND sts.job_table_name = 'production_jobs'
      AND pj.id = sts.job_id
      AND (p_division IS NULL OR pj.division = p_division)
    RETURNING sts.id
  )
  SELECT COUNT(*) INTO cleared_slots FROM deleted;
  
  RAISE NOTICE 'Cleared % non-completed time slots (division: %)', cleared_slots, COALESCE(p_division, 'ALL');
  
  -- Create stage availability tracker
  CREATE TEMP TABLE IF NOT EXISTS stage_availability (
    stage_id uuid PRIMARY KEY,
    next_available_time timestamptz NOT NULL
  );
  
  -- Initialize stage availability for all active non-DTP stages
  INSERT INTO stage_availability (stage_id, next_available_time)
  SELECT ps.id, base_time
  FROM production_stages ps
  LEFT JOIN stage_groups sg ON sg.id = ps.stage_group_id
  WHERE ps.is_active = true
    AND LOWER(COALESCE(sg.name, '')) != 'dtp'
    AND LOWER(ps.name) NOT LIKE '%proof%'
  ON CONFLICT (stage_id) DO UPDATE SET next_available_time = EXCLUDED.next_available_time;
  
  -- Process jobs in FIFO order: proof_approved_at first, then created_at as fallback
  FOR job_record IN
    SELECT DISTINCT 
      jsi.job_id,
      pj.wo_no,
      pj.division,
      COALESCE(pj.proof_approved_at, pj.created_at) as priority_timestamp
    FROM job_stage_instances jsi
    JOIN production_jobs pj ON jsi.job_id = pj.id
    WHERE jsi.job_table_name = 'production_jobs'
      AND jsi.status = 'pending'
      AND pj.proof_approved_at IS NOT NULL
      AND (p_division IS NULL OR pj.division = p_division)
    ORDER BY priority_timestamp ASC NULLS LAST
  LOOP
    RAISE NOTICE 'Processing job % (division: %, priority: %)', job_record.wo_no, job_record.division, job_record.priority_timestamp;
    
    -- Process stages for this job in stage_order, EXCLUDING DTP and Proof stages
    FOR stage_record IN
      SELECT 
        jsi.id,
        jsi.production_stage_id,
        jsi.stage_order,
        COALESCE(jsi.estimated_duration_minutes, 60) as duration_minutes,
        ps.name as stage_name,
        COALESCE(sg.name, 'Default') as stage_group
      FROM job_stage_instances jsi
      JOIN production_stages ps ON jsi.production_stage_id = ps.id
      LEFT JOIN stage_groups sg ON sg.id = ps.stage_group_id
      WHERE jsi.job_id = job_record.job_id
        AND jsi.job_table_name = 'production_jobs'  
        AND jsi.status = 'pending'
        -- CRITICAL: Exclude DTP and Proof stages
        AND LOWER(COALESCE(sg.name, '')) != 'dtp'
        AND LOWER(ps.name) NOT LIKE '%proof%'
      ORDER BY jsi.stage_order
    LOOP
      -- Get next available time for this stage
      SELECT next_available_time INTO slot_start
      FROM stage_availability
      WHERE stage_id = stage_record.production_stage_id;
      
      -- If stage doesn't exist in availability tracker, skip it
      IF slot_start IS NULL THEN
        RAISE WARNING 'Stage % not found in availability tracker, skipping', stage_record.stage_name;
        CONTINUE;
      END IF;
      
      -- Calculate slot end time (simple linear scheduling)
      slot_end := slot_start + (stage_record.duration_minutes || ' minutes')::interval;
      
      -- Adjust for working hours (8 AM - 5 PM) and lunch (12-1 PM)
      day_start := date_trunc('day', slot_start) + time '08:00:00';
      day_end := date_trunc('day', slot_start) + time '17:00:00';
      lunch_start := date_trunc('day', slot_start) + time '12:00:00';
      lunch_end := date_trunc('day', slot_start) + time '13:00:00';
      
      -- If slot starts before work hours, move to 8 AM
      IF slot_start < day_start THEN
        slot_start := day_start;
        slot_end := slot_start + (stage_record.duration_minutes || ' minutes')::interval;
      END IF;
      
      -- Handle lunch break (simple version: if overlaps lunch, add 1 hour)
      IF slot_start < lunch_end AND slot_end > lunch_start THEN
        slot_end := slot_end + interval '1 hour';
      END IF;
      
      -- If slot extends past working hours, carry over to next day
      WHILE slot_end > day_end LOOP
        -- Move to next working day
        working_date := (date_trunc('day', slot_end) + interval '1 day')::date;
        
        -- Skip weekends and holidays
        WHILE EXTRACT(dow FROM working_date) IN (0, 6) OR EXISTS (
          SELECT 1 FROM public_holidays WHERE date = working_date::date AND is_active = true
        ) LOOP
          working_date := working_date + interval '1 day';
        END LOOP;
        
        -- Recalculate from 8 AM next working day
        slot_start := working_date + time '08:00:00';
        slot_end := slot_start + (stage_record.duration_minutes || ' minutes')::interval;
        
        day_start := date_trunc('day', slot_start) + time '08:00:00';
        day_end := date_trunc('day', slot_start) + time '17:00:00';
        lunch_start := date_trunc('day', slot_start) + time '12:00:00';
        lunch_end := date_trunc('day', slot_start) + time '13:00:00';
        
        -- Check lunch again
        IF slot_start < lunch_end AND slot_end > lunch_start THEN
          slot_end := slot_end + interval '1 hour';
        END IF;
      END LOOP;
      
      -- Update stage instance with schedule
      UPDATE job_stage_instances
      SET 
        scheduled_start_at = slot_start,
        scheduled_end_at = slot_end,
        scheduled_minutes = stage_record.duration_minutes,
        schedule_status = 'scheduled',
        updated_at = now()
      WHERE id = stage_record.id;
      
      total_updated := total_updated + 1;
      
      -- Create time slot entry
      INSERT INTO stage_time_slots (
        production_stage_id,
        stage_instance_id,
        job_id,
        job_table_name,
        slot_start_time,
        slot_end_time,
        duration_minutes,
        is_completed,
        created_at
      ) VALUES (
        stage_record.production_stage_id,
        stage_record.id,
        job_record.job_id,
        'production_jobs',
        slot_start,
        slot_end,
        stage_record.duration_minutes,
        false,
        now()
      );
      
      total_slots := total_slots + 1;
      
      -- Update stage availability to next available time
      UPDATE stage_availability
      SET next_available_time = slot_end
      WHERE stage_id = stage_record.production_stage_id;
      
      RAISE NOTICE 'Scheduled stage % for job % from % to % (% minutes)', 
        stage_record.stage_name, job_record.wo_no, slot_start, slot_end, stage_record.duration_minutes;
    END LOOP;
  END LOOP;
  
  -- Cleanup temp table
  DROP TABLE IF EXISTS stage_availability;
  
  RAISE NOTICE '=== SCHEDULER COMPLETE: Updated % stages, created % slots (division: %) ===', 
    total_updated, total_slots, COALESCE(p_division, 'ALL');
  
  -- Return result
  RETURN jsonb_build_object(
    'ok', true,
    'wrote_slots', total_slots,
    'updated_jsi', total_updated,
    'dtp_stages_excluded', dtp_stages_excluded,
    'violations', violation_list,
    'division', COALESCE(p_division, 'ALL'),
    'cleared_stages', cleared_stages,
    'cleared_slots', cleared_slots
  );
END;
$$;

COMMENT ON FUNCTION public.scheduler_reschedule_all_parallel_aware(text) IS 
'Parallel-aware scheduler that excludes DTP/Proof stages. Supports optional division filtering: NULL = all divisions, string = specific division only.';

-- ====================================================================
-- PHASE 3: Performance indexes for division-scoped queries
-- ====================================================================

-- Index for production_jobs.division lookups
CREATE INDEX IF NOT EXISTS idx_production_jobs_division 
ON production_jobs(division) 
WHERE division IS NOT NULL;

-- Composite index for job_stage_instances filtering
CREATE INDEX IF NOT EXISTS idx_jsi_job_status_table 
ON job_stage_instances(job_id, job_table_name, status);

-- Composite index for stage_time_slots cleanup queries
CREATE INDEX IF NOT EXISTS idx_sts_job_completed 
ON stage_time_slots(job_id, job_table_name, is_completed) 
WHERE COALESCE(is_completed, false) = false;

-- Composite index for production_jobs approval tracking
CREATE INDEX IF NOT EXISTS idx_pj_division_approved 
ON production_jobs(division, proof_approved_at) 
WHERE proof_approved_at IS NOT NULL;

COMMENT ON INDEX idx_production_jobs_division IS 'Speeds up division-filtered scheduling queries';
COMMENT ON INDEX idx_jsi_job_status_table IS 'Optimizes job stage instance lookups in scheduler';
COMMENT ON INDEX idx_sts_job_completed IS 'Speeds up time slot cleanup for pending stages';
COMMENT ON INDEX idx_pj_division_approved IS 'Optimizes FIFO job ordering in scheduler';
