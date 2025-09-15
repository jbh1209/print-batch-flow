-- Create bulletproof scheduler function that is time-aware, parallel-aware, and precedence-aware
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_time_aware(
  p_start_from timestamptz DEFAULT NULL,
  p_commit boolean DEFAULT true
) RETURNS TABLE(
  wrote_slots integer,
  updated_jsi integer,
  violations text[]
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  start_time timestamptz;
  current_time timestamptz := now();
  next_8am timestamptz;
  slots_written integer := 0;
  stages_updated integer := 0;
  violation_list text[] := '{}';
  job_record RECORD;
  stage_record RECORD;
  slot_start timestamptz;
  slot_end timestamptz;
  stage_duration_mins integer;
  next_available_time timestamptz;
  predecessor_end_time timestamptz;
BEGIN
  -- Log function start
  RAISE NOTICE 'SCHEDULER: Starting bulletproof reschedule at % with start_from=%', current_time, p_start_from;

  -- Determine start time: next 8 AM or specified time
  IF p_start_from IS NOT NULL THEN
    start_time := p_start_from;
  ELSE
    -- Calculate next 8 AM in factory timezone
    next_8am := date_trunc('day', current_time AT TIME ZONE 'Africa/Johannesburg')::date + interval '1 day' + interval '8 hours';
    IF EXTRACT(hour FROM current_time AT TIME ZONE 'Africa/Johannesburg') < 8 THEN
      next_8am := date_trunc('day', current_time AT TIME ZONE 'Africa/Johannesburg')::date + interval '8 hours';
    END IF;
    start_time := next_8am AT TIME ZONE 'Africa/Johannesburg';
  END IF;

  RAISE NOTICE 'SCHEDULER: Calculated start time: %', start_time;

  -- NUCLEAR RESET: Clear all non-completed scheduling data
  IF p_commit THEN
    DELETE FROM public.stage_time_slots 
    WHERE COALESCE(is_completed, false) = false;
    GET DIAGNOSTICS slots_written = ROW_COUNT;
    RAISE NOTICE 'SCHEDULER: Nuclear reset - cleared % non-completed slots', slots_written;

    UPDATE public.job_stage_instances 
    SET 
      scheduled_start_at = NULL,
      scheduled_end_at = NULL,
      scheduled_minutes = NULL,
      schedule_status = 'unscheduled',
      updated_at = now()
    WHERE COALESCE(status, '') NOT IN ('completed', 'active')
      AND (scheduled_start_at IS NOT NULL OR scheduled_end_at IS NOT NULL);
    GET DIAGNOSTICS stages_updated = ROW_COUNT;
    RAISE NOTICE 'SCHEDULER: Nuclear reset - cleared scheduling from % stage instances', stages_updated;
  END IF;

  -- Initialize tracking for next available times per stage
  next_available_time := start_time;

  -- Process jobs in FIFO order (earliest proof approval first)
  FOR job_record IN
    WITH approved_jobs AS (
      SELECT DISTINCT 
        jsi.job_id,
        jsi.job_table_name,
        MAX(COALESCE(
          jsi.proof_approved_manually_at,
          jsi.updated_at
        )) as proof_approved_at
      FROM public.job_stage_instances jsi
      JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
      WHERE ps.name ILIKE '%proof%'
        AND (jsi.proof_approved_manually_at IS NOT NULL 
             OR jsi.status = 'completed')
      GROUP BY jsi.job_id, jsi.job_table_name
    )
    SELECT 
      aj.job_id,
      aj.job_table_name,
      aj.proof_approved_at,
      pj.wo_no,
      pj.qty
    FROM approved_jobs aj
    JOIN public.production_jobs pj ON aj.job_id = pj.id
    WHERE aj.job_table_name = 'production_jobs'
      AND pj.status NOT IN ('completed', 'cancelled', 'on_hold')
    ORDER BY aj.proof_approved_at ASC
  LOOP
    RAISE NOTICE 'SCHEDULER: Processing job % (WO: %)', job_record.job_id, job_record.wo_no;
    
    -- Reset next available time for this job
    next_available_time := start_time;
    
    -- Process stages in order for this job
    FOR stage_record IN
      SELECT 
        jsi.id,
        jsi.production_stage_id,
        jsi.stage_order,
        jsi.estimated_duration_minutes,
        jsi.part_assignment,
        ps.name as stage_name,
        ps.stage_group
      FROM public.job_stage_instances jsi
      JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
      WHERE jsi.job_id = job_record.job_id
        AND jsi.job_table_name = job_record.job_table_name
        AND jsi.status IN ('pending', 'scheduled')
        AND ps.name NOT ILIKE '%proof%'
        AND ps.name NOT ILIKE '%dtp%'
      ORDER BY jsi.stage_order ASC
    LOOP
      -- Get predecessor end time for precedence checking
      SELECT MAX(COALESCE(jsi2.scheduled_end_at, jsi2.completed_at)) INTO predecessor_end_time
      FROM public.job_stage_instances jsi2
      WHERE jsi2.job_id = job_record.job_id
        AND jsi2.job_table_name = job_record.job_table_name
        AND jsi2.stage_order < stage_record.stage_order
        AND jsi2.status IN ('completed', 'active', 'scheduled');

      -- Calculate stage duration
      stage_duration_mins := COALESCE(stage_record.estimated_duration_minutes, 60);
      
      -- Determine slot start time (respecting precedence)
      slot_start := GREATEST(
        next_available_time,
        COALESCE(predecessor_end_time, start_time)
      );
      
      -- Ensure slot starts within working hours (8 AM - 4 PM)
      WHILE EXTRACT(hour FROM slot_start AT TIME ZONE 'Africa/Johannesburg') < 8 
         OR EXTRACT(hour FROM slot_start AT TIME ZONE 'Africa/Johannesburg') >= 16
         OR EXTRACT(dow FROM slot_start AT TIME ZONE 'Africa/Johannesburg') IN (0, 6) -- Weekend
      LOOP
        slot_start := slot_start + interval '1 hour';
        IF EXTRACT(hour FROM slot_start AT TIME ZONE 'Africa/Johannesburg') >= 16 THEN
          slot_start := date_trunc('day', slot_start + interval '1 day') + interval '8 hours';
        END IF;
      END LOOP;

      slot_end := slot_start + make_interval(mins => stage_duration_mins);
      
      RAISE NOTICE 'SCHEDULER: Scheduling stage % (%) from % to % (%min)', 
        stage_record.stage_name, stage_record.id, slot_start, slot_end, stage_duration_mins;

      -- Update the stage instance with scheduling info
      IF p_commit THEN
        UPDATE public.job_stage_instances
        SET 
          scheduled_start_at = slot_start,
          scheduled_end_at = slot_end,
          scheduled_minutes = stage_duration_mins,
          schedule_status = 'scheduled',
          updated_at = now()
        WHERE id = stage_record.id;

        -- Create time slots
        INSERT INTO public.stage_time_slots (
          production_stage_id,
          stage_instance_id,
          job_id,
          job_table_name,
          slot_start_time,
          slot_end_time,
          duration_minutes,
          is_completed
        ) VALUES (
          stage_record.production_stage_id,
          stage_record.id,
          job_record.job_id,
          job_record.job_table_name,
          slot_start,
          slot_end,
          stage_duration_mins,
          false
        );
        
        slots_written := slots_written + 1;
        stages_updated := stages_updated + 1;
      END IF;
      
      -- Update next available time for sequential stages
      -- For parallel stages (printing), allow overlap but track separately
      IF stage_record.stage_group ILIKE '%print%' AND stage_record.part_assignment IS NOT NULL THEN
        -- Parallel stage - don't advance next_available_time as much
        next_available_time := GREATEST(next_available_time, slot_start + interval '30 minutes');
      ELSE
        -- Sequential stage - must wait for completion
        next_available_time := slot_end;
      END IF;
      
    END LOOP;
  END LOOP;

  RAISE NOTICE 'SCHEDULER: Completed bulletproof reschedule - wrote % slots, updated % stages', slots_written, stages_updated;

  -- Return results
  RETURN QUERY SELECT slots_written, stages_updated, violation_list;
END;
$$;