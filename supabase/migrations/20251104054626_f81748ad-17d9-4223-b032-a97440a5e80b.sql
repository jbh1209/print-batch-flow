-- Drop and recreate to restore true parallel processing with per-part predecessor gating
DROP FUNCTION IF EXISTS public.scheduler_reschedule_all_parallel_aware(timestamptz);

CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware(
  p_start_from timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_time timestamptz;
  v_wrote_slots integer := 0;
  v_updated_jsi integer := 0;
  
  r_job record;
  r_stage record;
  
  stage_earliest_start timestamptz;
  actual_end_time timestamptz;
  predecessor_end timestamptz;
  
  job_part_barriers jsonb := '{}'::jsonb;
  cover_part_end timestamptz;
  text_part_end timestamptz;
BEGIN
  v_base_time := COALESCE(p_start_from, NOW());
  RAISE NOTICE '[PARALLEL] Starting parallel-aware scheduler at %', v_base_time;
  
  PERFORM public.clear_non_completed_scheduling_data();
  RAISE NOTICE '[PARALLEL] Cleared non-completed scheduling data';
  
  UPDATE public.machine_resources
  SET _stage_tails = v_base_time
  WHERE _stage_tails IS NULL OR _stage_tails < v_base_time;
  
  FOR r_job IN
    SELECT DISTINCT pj.id as job_id, pj.proof_approved_at
    FROM public.production_jobs pj
    WHERE pj.proof_approved_at IS NOT NULL
      AND pj.status NOT IN ('cancelled', 'completed')
    ORDER BY pj.proof_approved_at ASC
  LOOP
    RAISE NOTICE '[PARALLEL] Processing job %', r_job.job_id;
    
    job_part_barriers := jsonb_set(
      job_part_barriers,
      ARRAY[r_job.job_id::text],
      '{"cover": null, "text": null}'::jsonb
    );
    
    FOR r_stage IN
      SELECT jsi.id as jsi_id, jsi.production_stage_id, ps.name as stage_name,
             ps.stage_order, ps.part_assignment, ps.estimated_duration_minutes,
             ps.machine_resource_id
      FROM public.job_stage_instances jsi
      JOIN public.production_stages ps ON ps.id = jsi.production_stage_id
      WHERE jsi.production_job_id = r_job.job_id
        AND jsi.scheduled_start_at IS NULL
        AND ps.stage_order IS NOT NULL
      ORDER BY ps.stage_order ASC
    LOOP
      stage_earliest_start := v_base_time;
      
      -- PER-PART PREDECESSOR GATING (this is the fix!)
      IF r_stage.part_assignment = 'both' THEN
        SELECT MAX(jsi2.scheduled_end_at) INTO predecessor_end
        FROM public.job_stage_instances jsi2
        JOIN public.production_stages ps2 ON ps2.id = jsi2.production_stage_id
        WHERE jsi2.production_job_id = r_job.job_id
          AND ps2.stage_order < r_stage.stage_order
          AND jsi2.scheduled_end_at IS NOT NULL;
          
      ELSIF r_stage.part_assignment = 'text' THEN
        SELECT MAX(jsi2.scheduled_end_at) INTO predecessor_end
        FROM public.job_stage_instances jsi2
        JOIN public.production_stages ps2 ON ps2.id = jsi2.production_stage_id
        WHERE jsi2.production_job_id = r_job.job_id
          AND ps2.stage_order < r_stage.stage_order
          AND ps2.part_assignment IN ('text', 'both')
          AND jsi2.scheduled_end_at IS NOT NULL;
          
      ELSIF r_stage.part_assignment = 'cover' THEN
        SELECT MAX(jsi2.scheduled_end_at) INTO predecessor_end
        FROM public.job_stage_instances jsi2
        JOIN public.production_stages ps2 ON ps2.id = jsi2.production_stage_id
        WHERE jsi2.production_job_id = r_job.job_id
          AND ps2.stage_order < r_stage.stage_order
          AND ps2.part_assignment IN ('cover', 'both')
          AND jsi2.scheduled_end_at IS NOT NULL;
          
      ELSE
        SELECT MAX(jsi2.scheduled_end_at) INTO predecessor_end
        FROM public.job_stage_instances jsi2
        JOIN public.production_stages ps2 ON ps2.id = jsi2.production_stage_id
        WHERE jsi2.production_job_id = r_job.job_id
          AND ps2.stage_order < r_stage.stage_order
          AND COALESCE(ps2.part_assignment, 'main') IN ('main', 'both')
          AND jsi2.scheduled_end_at IS NOT NULL;
      END IF;
      
      IF predecessor_end IS NOT NULL AND predecessor_end > stage_earliest_start THEN
        stage_earliest_start := predecessor_end;
      END IF;
      
      -- Convergence logic for 'both' stages
      IF r_stage.part_assignment = 'both' THEN
        cover_part_end := (job_part_barriers->r_job.job_id::text->>'cover')::timestamptz;
        text_part_end := (job_part_barriers->r_job.job_id::text->>'text')::timestamptz;
        
        IF cover_part_end IS NOT NULL OR text_part_end IS NOT NULL THEN
          stage_earliest_start := GREATEST(
            stage_earliest_start,
            COALESCE(cover_part_end, stage_earliest_start),
            COALESCE(text_part_end, stage_earliest_start)
          );
        END IF;
      END IF;
      
      SELECT public.place_duration_sql(
        r_stage.machine_resource_id,
        stage_earliest_start,
        r_stage.estimated_duration_minutes
      ) INTO actual_end_time;
      
      UPDATE public.job_stage_instances
      SET scheduled_start_at = stage_earliest_start,
          scheduled_end_at = actual_end_time,
          updated_at = NOW()
      WHERE id = r_stage.jsi_id;
      
      v_updated_jsi := v_updated_jsi + 1;
      
      INSERT INTO public.stage_time_slots (
        stage_instance_id, production_stage_id,
        slot_start_time, slot_end_time
      ) VALUES (
        r_stage.jsi_id, r_stage.production_stage_id,
        stage_earliest_start, actual_end_time
      );
      
      v_wrote_slots := v_wrote_slots + 1;
      
      IF r_stage.part_assignment = 'cover' THEN
        job_part_barriers := jsonb_set(
          job_part_barriers,
          ARRAY[r_job.job_id::text, 'cover'],
          to_jsonb(actual_end_time)
        );
      ELSIF r_stage.part_assignment = 'text' THEN
        job_part_barriers := jsonb_set(
          job_part_barriers,
          ARRAY[r_job.job_id::text, 'text'],
          to_jsonb(actual_end_time)
        );
      END IF;
      
      RAISE NOTICE '[PARALLEL] Scheduled % (%) for job % from % to %',
        r_stage.stage_name, r_stage.part_assignment, r_job.job_id,
        stage_earliest_start, actual_end_time;
    END LOOP;
  END LOOP;
  
  RETURN jsonb_build_object(
    'wrote_slots', v_wrote_slots,
    'updated_jsi', v_updated_jsi
  );
END;
$$;