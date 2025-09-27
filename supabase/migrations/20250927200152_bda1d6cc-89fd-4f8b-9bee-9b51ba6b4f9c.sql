-- Drop and recreate scheduler functions with non-reserved variable names

-- Drop existing functions
DROP FUNCTION IF EXISTS public.simple_scheduler_wrapper_20241227_1445(text, uuid[], timestamptz);
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_parts_20241227_1445(timestamptz);
DROP FUNCTION IF EXISTS public.scheduler_append_jobs_20241227_1445(uuid[], timestamptz);

-- 1. Create the main wrapper function
CREATE OR REPLACE FUNCTION public.simple_scheduler_wrapper_20241227_1445(
  p_mode text DEFAULT 'reschedule_all',
  p_job_ids uuid[] DEFAULT NULL,
  p_start_from timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_data jsonb;
  start_time_calc timestamptz;
BEGIN
  start_time_calc := COALESCE(p_start_from, now());
  
  INSERT INTO public.batch_allocation_logs (action, details, job_id)
  VALUES (
    'scheduler_wrapper_called',
    jsonb_build_object(
      'mode', p_mode,
      'job_count', COALESCE(array_length(p_job_ids, 1), 0),
      'start_from', start_time_calc
    ),
    CASE WHEN p_job_ids IS NOT NULL AND array_length(p_job_ids, 1) > 0 THEN p_job_ids[1] ELSE NULL END
  );
  
  IF p_mode = 'append_jobs' AND p_job_ids IS NOT NULL THEN
    SELECT public.scheduler_append_jobs_20241227_1445(p_job_ids, start_time_calc) INTO result_data;
  ELSE
    SELECT public.scheduler_reschedule_all_parallel_parts_20241227_1445(start_time_calc) INTO result_data;
  END IF;
  
  RETURN result_data;
END;
$$;

-- 2. Create the main scheduling function
CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_parts_20241227_1445(
  p_start_from timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_record RECORD;
  job_record RECORD;
  placement_result jsonb;
  total_scheduled integer := 0;
  total_slots integer := 0;
  start_time_calc timestamptz;
  stage_next_time timestamptz;
  job_duration integer;
BEGIN
  start_time_calc := COALESCE(p_start_from, now());
  
  -- Clear existing scheduling data
  DELETE FROM stage_time_slots WHERE COALESCE(is_completed, false) = false;
  
  UPDATE job_stage_instances 
  SET 
    scheduled_start_at = NULL,
    scheduled_end_at = NULL,
    scheduled_minutes = NULL,
    schedule_status = 'unscheduled'
  WHERE COALESCE(status, '') NOT IN ('completed', 'active');
  
  -- Create temp table for stage availability
  DROP TABLE IF EXISTS _stage_tails;
  CREATE TEMP TABLE _stage_tails (
    stage_id uuid PRIMARY KEY,
    next_available_time timestamptz NOT NULL
  );
  
  INSERT INTO _stage_tails (stage_id, next_available_time)
  SELECT DISTINCT ps.id, start_time_calc
  FROM production_stages ps
  WHERE ps.is_active = true;
  
  -- Process jobs in FIFO order
  FOR job_record IN
    SELECT DISTINCT 
      jsi.job_id,
      pj.wo_no,
      MIN(pj.proof_approved_at) as proof_approved_at
    FROM job_stage_instances jsi
    JOIN production_jobs pj ON jsi.job_id = pj.id
    WHERE jsi.job_table_name = 'production_jobs'
      AND pj.proof_approved_at IS NOT NULL
      AND COALESCE(jsi.status, 'pending') = 'pending'
    GROUP BY jsi.job_id, pj.wo_no
    ORDER BY MIN(pj.proof_approved_at) ASC, pj.wo_no ASC
  LOOP
    FOR stage_record IN
      SELECT 
        jsi.id,
        jsi.production_stage_id,
        jsi.estimated_duration_minutes,
        jsi.scheduled_minutes,
        ps.name as stage_name
      FROM job_stage_instances jsi
      JOIN production_stages ps ON jsi.production_stage_id = ps.id
      WHERE jsi.job_id = job_record.job_id
        AND jsi.job_table_name = 'production_jobs'
        AND COALESCE(jsi.status, 'pending') = 'pending'
        AND ps.name NOT ILIKE '%dtp%'
        AND ps.name NOT ILIKE '%proof%'
        AND ps.name NOT ILIKE '%batch%allocation%'
      ORDER BY jsi.stage_order ASC
    LOOP
      SELECT next_available_time INTO stage_next_time
      FROM _stage_tails
      WHERE stage_id = stage_record.production_stage_id;
      
      job_duration := COALESCE(stage_record.scheduled_minutes, stage_record.estimated_duration_minutes, 60);
      
      -- Use place_duration_sql for lunch/shift handling
      SELECT public.place_duration_sql(stage_next_time, job_duration) INTO placement_result;
      
      IF placement_result IS NOT NULL AND jsonb_array_length(placement_result) > 0 THEN
        UPDATE job_stage_instances
        SET 
          scheduled_start_at = (placement_result->0->>'start_time')::timestamptz,
          scheduled_end_at = (placement_result->(jsonb_array_length(placement_result)-1)->>'end_time')::timestamptz,
          scheduled_minutes = job_duration,
          schedule_status = 'scheduled',
          updated_at = now()
        WHERE id = stage_record.id;
        
        FOR i IN 0..(jsonb_array_length(placement_result)-1) LOOP
          INSERT INTO stage_time_slots (
            production_stage_id,
            job_id,
            stage_instance_id,
            slot_start_time,
            slot_end_time,
            duration_minutes,
            date,
            job_table_name
          ) VALUES (
            stage_record.production_stage_id,
            job_record.job_id,
            stage_record.id,
            (placement_result->i->>'start_time')::timestamptz,
            (placement_result->i->>'end_time')::timestamptz,
            (placement_result->i->>'duration_minutes')::integer,
            (placement_result->i->>'date')::date,
            'production_jobs'
          );
          total_slots := total_slots + 1;
        END LOOP;
        
        UPDATE _stage_tails
        SET next_available_time = (placement_result->(jsonb_array_length(placement_result)-1)->>'end_time')::timestamptz
        WHERE stage_id = stage_record.production_stage_id;
        
        total_scheduled := total_scheduled + 1;
      END IF;
    END LOOP;
  END LOOP;
  
  DROP TABLE IF EXISTS _stage_tails;
  
  RETURN jsonb_build_object(
    'scheduled_count', total_scheduled,
    'wrote_slots', total_slots,
    'success', true,
    'mode', 'reschedule_all'
  );
END;
$$;

-- 3. Create the append jobs function
CREATE OR REPLACE FUNCTION public.scheduler_append_jobs_20241227_1445(
  p_job_ids uuid[],
  p_start_from timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stage_record RECORD;
  job_record RECORD;
  placement_result jsonb;
  total_scheduled integer := 0;
  total_slots integer := 0;
  start_time_calc timestamptz;
  stage_next_time timestamptz;
  job_duration integer;
BEGIN
  start_time_calc := COALESCE(p_start_from, now());
  
  IF p_job_ids IS NULL OR array_length(p_job_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'scheduled_count', 0,
      'wrote_slots', 0,
      'success', false,
      'error', 'No job IDs provided',
      'mode', 'append_jobs'
    );
  END IF;
  
  DROP TABLE IF EXISTS _stage_tails;
  CREATE TEMP TABLE _stage_tails (
    stage_id uuid PRIMARY KEY,
    next_available_time timestamptz NOT NULL
  );
  
  INSERT INTO _stage_tails (stage_id, next_available_time)
  SELECT 
    ps.id,
    COALESCE(MAX(sts.slot_end_time), start_time_calc) as next_time
  FROM production_stages ps
  LEFT JOIN stage_time_slots sts ON ps.id = sts.production_stage_id
  WHERE ps.is_active = true
  GROUP BY ps.id;
  
  FOR job_record IN
    SELECT DISTINCT 
      jsi.job_id,
      pj.wo_no,
      pj.proof_approved_at
    FROM job_stage_instances jsi
    JOIN production_jobs pj ON jsi.job_id = pj.id
    WHERE jsi.job_table_name = 'production_jobs'
      AND jsi.job_id = ANY(p_job_ids)
      AND pj.proof_approved_at IS NOT NULL
      AND COALESCE(jsi.status, 'pending') = 'pending'
    ORDER BY pj.proof_approved_at ASC, pj.wo_no ASC
  LOOP
    FOR stage_record IN
      SELECT 
        jsi.id,
        jsi.production_stage_id,
        jsi.estimated_duration_minutes,
        jsi.scheduled_minutes,
        ps.name as stage_name
      FROM job_stage_instances jsi
      JOIN production_stages ps ON jsi.production_stage_id = ps.id
      WHERE jsi.job_id = job_record.job_id
        AND jsi.job_table_name = 'production_jobs'
        AND COALESCE(jsi.status, 'pending') = 'pending'
        AND ps.name NOT ILIKE '%dtp%'
        AND ps.name NOT ILIKE '%proof%'
        AND ps.name NOT ILIKE '%batch%allocation%'
      ORDER BY jsi.stage_order ASC
    LOOP
      SELECT next_available_time INTO stage_next_time
      FROM _stage_tails
      WHERE stage_id = stage_record.production_stage_id;
      
      job_duration := COALESCE(stage_record.scheduled_minutes, stage_record.estimated_duration_minutes, 60);
      
      SELECT public.place_duration_sql(stage_next_time, job_duration) INTO placement_result;
      
      IF placement_result IS NOT NULL AND jsonb_array_length(placement_result) > 0 THEN
        UPDATE job_stage_instances
        SET 
          scheduled_start_at = (placement_result->0->>'start_time')::timestamptz,
          scheduled_end_at = (placement_result->(jsonb_array_length(placement_result)-1)->>'end_time')::timestamptz,
          scheduled_minutes = job_duration,
          schedule_status = 'scheduled',
          updated_at = now()
        WHERE id = stage_record.id;
        
        FOR i IN 0..(jsonb_array_length(placement_result)-1) LOOP
          INSERT INTO stage_time_slots (
            production_stage_id,
            job_id,
            stage_instance_id,
            slot_start_time,
            slot_end_time,
            duration_minutes,
            date,
            job_table_name
          ) VALUES (
            stage_record.production_stage_id,
            job_record.job_id,
            stage_record.id,
            (placement_result->i->>'start_time')::timestamptz,
            (placement_result->i->>'end_time')::timestamptz,
            (placement_result->i->>'duration_minutes')::integer,
            (placement_result->i->>'date')::date,
            'production_jobs'
          );
          total_slots := total_slots + 1;
        END LOOP;
        
        UPDATE _stage_tails
        SET next_available_time = (placement_result->(jsonb_array_length(placement_result)-1)->>'end_time')::timestamptz
        WHERE stage_id = stage_record.production_stage_id;
        
        total_scheduled := total_scheduled + 1;
      END IF;
    END LOOP;
  END LOOP;
  
  DROP TABLE IF EXISTS _stage_tails;
  
  RETURN jsonb_build_object(
    'scheduled_count', total_scheduled,
    'wrote_slots', total_slots,
    'success', true,
    'mode', 'append_jobs',
    'job_count', array_length(p_job_ids, 1)
  );
END;
$$;