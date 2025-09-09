-- Emergency fix for scheduler function conflict
-- Drop both versions of the function explicitly by signature

-- Drop the version with timestamp parameter (oid: 232739)
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(timestamp with time zone);

-- Drop the version without parameters (oid: 237881)  
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware();

-- Recreate only the correct parameterless version
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware()
 RETURNS TABLE(updated_jsi integer, wrote_slots integer, violations text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
BEGIN
  -- Advisory lock to prevent concurrent scheduling
  PERFORM pg_advisory_xact_lock(1, 42);
  
  -- Start scheduling from tomorrow at 8 AM (next working day)
  working_date := CURRENT_DATE + interval '1 day';
  
  -- Find next working day (skip weekends)
  WHILE EXTRACT(dow FROM working_date) IN (0, 6) OR EXISTS (
    SELECT 1 FROM public_holidays WHERE date = working_date::date AND is_active = true
  ) LOOP
    working_date := working_date + interval '1 day';
  END LOOP;
  
  base_time := working_date + time '08:00:00';
  
  RAISE NOTICE 'Starting FIFO scheduler with working hours from: %', base_time;
  
  -- Clear all existing schedules for pending stages
  UPDATE job_stage_instances 
  SET 
    scheduled_start_at = NULL,
    scheduled_end_at = NULL,
    scheduled_minutes = NULL,
    schedule_status = NULL,
    updated_at = now()
  WHERE status = 'pending';
  
  -- Clear all existing time slots
  DELETE FROM stage_time_slots WHERE COALESCE(is_completed, false) = false;
  
  -- Create stage availability tracker
  CREATE TEMP TABLE IF NOT EXISTS stage_availability (
    stage_id uuid PRIMARY KEY,
    next_available_time timestamptz NOT NULL
  );
  
  -- Initialize stage availability for all active stages
  INSERT INTO stage_availability (stage_id, next_available_time)
  SELECT id, base_time
  FROM production_stages 
  WHERE is_active = true
  ON CONFLICT (stage_id) DO UPDATE SET next_available_time = EXCLUDED.next_available_time;
  
  -- Process jobs in FIFO order: proof_approved_at first, then created_at as fallback
  FOR job_record IN
    SELECT DISTINCT 
      jsi.job_id,
      pj.wo_no,
      COALESCE(pj.proof_approved_at, pj.created_at) as priority_timestamp
    FROM job_stage_instances jsi
    JOIN production_jobs pj ON jsi.job_id = pj.id
    WHERE jsi.job_table_name = 'production_jobs'
      AND jsi.status = 'pending'
    ORDER BY priority_timestamp ASC NULLS LAST  -- FIFO ordering
  LOOP
    RAISE NOTICE 'Processing job % (priority: %)', job_record.wo_no, job_record.priority_timestamp;
    
    -- Process stages for this job in stage_order
    FOR stage_record IN
      SELECT 
        jsi.id,
        jsi.production_stage_id,
        jsi.stage_order,
        COALESCE(jsi.estimated_duration_minutes, 60) as duration_minutes,
        ps.name as stage_name
      FROM job_stage_instances jsi
      JOIN production_stages ps ON jsi.production_stage_id = ps.id
      WHERE jsi.job_id = job_record.job_id
        AND jsi.job_table_name = 'production_jobs'  
        AND jsi.status = 'pending'
      ORDER BY jsi.stage_order
    LOOP
      -- Get next available time for this stage
      SELECT next_available_time INTO slot_start
      FROM stage_availability 
      WHERE stage_id = stage_record.production_stage_id;
      
      -- Simple working hours check: ensure we're within 8:00-12:00 or 12:30-16:30
      WHILE TRUE LOOP
        day_start := slot_start::date + time '08:00:00';
        day_end := slot_start::date + time '16:30:00';
        lunch_start := slot_start::date + time '12:00:00';
        lunch_end := slot_start::date + time '12:30:00';
        
        -- If we're before working hours, move to start of day
        IF slot_start < day_start THEN
          slot_start := day_start;
        END IF;
        
        -- If we're in lunch break, move to after lunch
        IF slot_start >= lunch_start AND slot_start < lunch_end THEN
          slot_start := lunch_end;
        END IF;
        
        -- Calculate slot end
        slot_end := slot_start + make_interval(mins => stage_record.duration_minutes);
        
        -- Check if job fits in current day
        IF slot_end <= day_end AND (slot_end <= lunch_start OR slot_start >= lunch_end) THEN
          -- Fits in current working day
          EXIT;
        ELSIF slot_start < lunch_start AND slot_end > lunch_start THEN
          -- Would cross lunch break - schedule after lunch
          slot_start := lunch_end;
          slot_end := slot_start + make_interval(mins => stage_record.duration_minutes);
          IF slot_end <= day_end THEN
            EXIT;
          END IF;
        END IF;
        
        -- Move to next working day
        working_date := (slot_start::date + interval '1 day');
        WHILE EXTRACT(dow FROM working_date) IN (0, 6) OR EXISTS (
          SELECT 1 FROM public_holidays WHERE date = working_date::date AND is_active = true
        ) LOOP
          working_date := working_date + interval '1 day';
        END LOOP;
        slot_start := working_date + time '08:00:00';
      END LOOP;
      
      -- Update job stage instance with schedule
      UPDATE job_stage_instances 
      SET 
        scheduled_start_at = slot_start,
        scheduled_end_at = slot_end,
        scheduled_minutes = stage_record.duration_minutes,
        schedule_status = 'scheduled',
        updated_at = now()
      WHERE id = stage_record.id;
      
      -- Create time slot
      INSERT INTO stage_time_slots (
        production_stage_id,
        job_id,
        stage_instance_id,
        slot_start_time,
        slot_end_time,
        duration_minutes,
        job_table_name
      ) VALUES (
        stage_record.production_stage_id,
        job_record.job_id,
        stage_record.id,
        slot_start,
        slot_end,
        stage_record.duration_minutes,
        'production_jobs'
      );
      
      -- Update stage availability
      UPDATE stage_availability 
      SET next_available_time = slot_end
      WHERE stage_id = stage_record.production_stage_id;
      
      total_updated := total_updated + 1;
      total_slots := total_slots + 1;
      
      RAISE NOTICE 'Scheduled % stage % for job % from % to % (duration: %min)', 
        stage_record.stage_name, stage_record.production_stage_id, job_record.wo_no, 
        slot_start, slot_end, stage_record.duration_minutes;
    END LOOP;
  END LOOP;
  
  DROP TABLE IF EXISTS stage_availability;
  
  RAISE NOTICE 'FIFO scheduler completed: % stages updated, % time slots created', total_updated, total_slots;
  
  RETURN QUERY SELECT total_updated, total_slots, violation_list;
END;
$function$;