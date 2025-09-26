-- Fix scheduler routing and parallel processing barriers per Sep 24 documentation

-- 1. Correct simple_scheduler_wrapper routing to match Sep 24 reference
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper(p_mode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  wrote_slots integer;
  updated_jsi integer;
  violations jsonb;
BEGIN
  -- Route ALL modes to scheduler_resource_fill_optimized per Sep 24 docs
  SELECT * INTO wrote_slots, updated_jsi, violations 
  FROM public.scheduler_resource_fill_optimized();

  -- Return JSON object from extracted values
  RETURN jsonb_build_object(
    'wrote_slots', wrote_slots,
    'updated_jsi', updated_jsi,
    'violations', COALESCE(violations, '[]'::jsonb)
  );
END;
$$;

-- 2. Drop and recreate scheduler_reschedule_all_sequential_fixed to fix per-part barriers
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_sequential_fixed(timestamptz);

CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_sequential_fixed(start_from_time timestamptz)
RETURNS TABLE(wrote_slots integer, updated_jsi integer, violations jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_record RECORD;
  stage_record RECORD;
  layer_record RECORD;
  job_current_barrier timestamptz;
  job_part_barriers jsonb := '{}'::jsonb;
  cover_barrier timestamptz;
  text_barrier timestamptz;
  stage_earliest_start timestamptz;
  resource_available_time timestamptz;
  stage_end_time timestamptz;
  slots_created integer := 0;
  jsi_updated integer := 0;
  validation_issues jsonb := '[]'::jsonb;
  current_slot_data jsonb;
BEGIN
  -- Clear non-completed scheduling data
  PERFORM public.clear_non_completed_scheduling_data();
  
  -- Create stage availability tracker
  PERFORM public.create_stage_availability_tracker();

  -- Process jobs in FIFO order by proof approval
  FOR job_record IN
    SELECT DISTINCT
      pj.id as job_id,
      pj.wo_no,
      pj.proof_approved_at
    FROM production_jobs pj
    WHERE pj.proof_approved_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM job_stage_instances jsi 
        WHERE jsi.job_id = pj.id 
          AND jsi.job_table_name = 'production_jobs'
          AND COALESCE(jsi.status, 'pending') = 'pending'
      )
    ORDER BY pj.proof_approved_at ASC
  LOOP
    -- Initialize job barriers
    job_current_barrier := start_from_time;
    job_part_barriers := '{}'::jsonb;
    
    RAISE NOTICE 'Processing job % with barriers starting at %', 
      job_record.wo_no, job_current_barrier;

    -- Process stages by stage_order layers
    FOR layer_record IN
      SELECT DISTINCT stage_order 
      FROM job_stage_instances jsi
      WHERE jsi.job_id = job_record.job_id 
        AND jsi.job_table_name = 'production_jobs'
        AND COALESCE(jsi.status, 'pending') = 'pending'
      ORDER BY stage_order ASC
    LOOP
      RAISE NOTICE 'Processing layer % for job %', 
        layer_record.stage_order, job_record.wo_no;

      -- Process all stages in this layer
      FOR stage_record IN
        SELECT 
          jsi.id,
          jsi.production_stage_id,
          jsi.part_assignment,
          jsi.dependency_group,
          ps.name as stage_name,
          COALESCE(jsi.estimated_duration_minutes, 30) + COALESCE(jsi.setup_time_minutes, 10) as total_minutes
        FROM job_stage_instances jsi
        JOIN production_stages ps ON jsi.production_stage_id = ps.id
        WHERE jsi.job_id = job_record.job_id 
          AND jsi.job_table_name = 'production_jobs'
          AND jsi.stage_order = layer_record.stage_order
          AND COALESCE(jsi.status, 'pending') = 'pending'
        ORDER BY jsi.created_at ASC
      LOOP
        -- Get resource availability
        SELECT COALESCE(next_available_time, start_from_time) 
        INTO resource_available_time
        FROM _stage_tails 
        WHERE stage_id = stage_record.production_stage_id;
        
        IF resource_available_time IS NULL THEN
          resource_available_time := start_from_time;
        END IF;

        -- Compute stage earliest start using per-part barriers
        IF stage_record.part_assignment = 'cover' THEN
          -- Use cover barrier
          cover_barrier := COALESCE(
            (job_part_barriers->>'cover')::timestamptz, 
            job_current_barrier
          );
          stage_earliest_start := GREATEST(cover_barrier, resource_available_time);
          RAISE NOTICE 'Cover stage % earliest start: % (cover barrier: %, resource: %)', 
            stage_record.stage_name, stage_earliest_start, cover_barrier, resource_available_time;
            
        ELSIF stage_record.part_assignment = 'text' THEN
          -- Use text barrier
          text_barrier := COALESCE(
            (job_part_barriers->>'text')::timestamptz, 
            job_current_barrier
          );
          stage_earliest_start := GREATEST(text_barrier, resource_available_time);
          RAISE NOTICE 'Text stage % earliest start: % (text barrier: %, resource: %)', 
            stage_record.stage_name, stage_earliest_start, text_barrier, resource_available_time;
            
        ELSIF stage_record.part_assignment = 'both' THEN
          -- Use convergence of both barriers
          cover_barrier := COALESCE(
            (job_part_barriers->>'cover')::timestamptz, 
            job_current_barrier
          );
          text_barrier := COALESCE(
            (job_part_barriers->>'text')::timestamptz, 
            job_current_barrier
          );
          stage_earliest_start := GREATEST(
            GREATEST(cover_barrier, text_barrier), 
            resource_available_time
          );
          RAISE NOTICE 'Both stage % earliest start: % (cover: %, text: %, resource: %)', 
            stage_record.stage_name, stage_earliest_start, cover_barrier, text_barrier, resource_available_time;
            
        ELSE
          -- No part assignment - use job barrier
          stage_earliest_start := GREATEST(job_current_barrier, resource_available_time);
          RAISE NOTICE 'General stage % earliest start: % (job barrier: %, resource: %)', 
            stage_record.stage_name, stage_earliest_start, job_current_barrier, resource_available_time;
        END IF;

        -- Place duration across working hours
        SELECT public.place_duration_sql(stage_earliest_start, stage_record.total_minutes) 
        INTO current_slot_data;

        -- Extract end time from slot data
        stage_end_time := (
          SELECT MAX((slot->>'end_time')::timestamptz)
          FROM jsonb_array_elements(current_slot_data) AS slot
        );

        -- Update job stage instance with schedule
        UPDATE job_stage_instances 
        SET 
          scheduled_start_at = stage_earliest_start,
          scheduled_end_at = stage_end_time,
          scheduled_minutes = stage_record.total_minutes,
          schedule_status = 'scheduled',
          updated_at = now()
        WHERE id = stage_record.id;
        
        jsi_updated := jsi_updated + 1;

        -- Create time slots
        INSERT INTO stage_time_slots (
          production_stage_id,
          job_id,
          stage_instance_id,
          job_table_name,
          date,
          slot_start_time,
          slot_end_time,
          duration_minutes
        )
        SELECT 
          stage_record.production_stage_id,
          job_record.job_id,
          stage_record.id,
          'production_jobs',
          (slot->>'date')::date,
          (slot->>'start_time')::timestamptz,
          (slot->>'end_time')::timestamptz,
          (slot->>'duration_minutes')::integer
        FROM jsonb_array_elements(current_slot_data) AS slot;
        
        slots_created := slots_created + jsonb_array_length(current_slot_data);

        -- Update resource availability
        INSERT INTO _stage_tails (stage_id, next_available_time)
        VALUES (stage_record.production_stage_id, stage_end_time)
        ON CONFLICT (stage_id) 
        DO UPDATE SET next_available_time = EXCLUDED.next_available_time;

        -- Update per-part barriers based on stage assignment
        IF stage_record.part_assignment = 'cover' THEN
          job_part_barriers := jsonb_set(
            job_part_barriers, 
            '{cover}', 
            to_jsonb(stage_end_time::text)
          );
        ELSIF stage_record.part_assignment = 'text' THEN
          job_part_barriers := jsonb_set(
            job_part_barriers, 
            '{text}', 
            to_jsonb(stage_end_time::text)
          );
        ELSIF stage_record.part_assignment = 'both' THEN
          -- Both parts advance together
          job_part_barriers := jsonb_set(
            jsonb_set(job_part_barriers, '{cover}', to_jsonb(stage_end_time::text)),
            '{text}', 
            to_jsonb(stage_end_time::text)
          );
        END IF;

      END LOOP; -- End stage loop

      -- Advance job barrier to the latest end in this layer (for non-part stages)
      SELECT MAX(scheduled_end_at) INTO job_current_barrier
      FROM job_stage_instances jsi
      WHERE jsi.job_id = job_record.job_id 
        AND jsi.job_table_name = 'production_jobs'
        AND jsi.stage_order = layer_record.stage_order
        AND jsi.scheduled_end_at IS NOT NULL;

      RAISE NOTICE 'Completed layer %, job barrier advanced to %', 
        layer_record.stage_order, job_current_barrier;

    END LOOP; -- End layer loop
  END LOOP; -- End job loop

  RETURN QUERY SELECT slots_created, jsi_updated, validation_issues;
END;
$$;