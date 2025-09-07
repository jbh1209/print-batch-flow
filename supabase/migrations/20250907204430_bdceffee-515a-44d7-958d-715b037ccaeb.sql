-- Fix infrastructure to ensure all proof approvals get proper timestamps

-- 1. Update advance_job_stage function to automatically set proof approval timestamps
CREATE OR REPLACE FUNCTION public.advance_job_stage(p_job_id uuid, p_job_table_name text, p_current_stage_id uuid, p_completed_by uuid DEFAULT auth.uid(), p_notes text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  current_stage_record RECORD;
  actual_duration_minutes INTEGER;
  next_stage_record RECORD;
  is_proof_stage BOOLEAN := FALSE;
  current_timestamp TIMESTAMPTZ := now();
BEGIN
  -- Get the current stage instance
  SELECT jsi.*, ps.name as stage_name INTO current_stage_record
  FROM public.job_stage_instances jsi
  JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
  WHERE jsi.job_id = p_job_id 
    AND jsi.job_table_name = p_job_table_name
    AND jsi.id = p_current_stage_id
    AND jsi.status = 'active';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Current stage not found or not active';
  END IF;
  
  -- Check if this is a proof stage
  is_proof_stage := current_stage_record.stage_name ILIKE '%proof%';
  
  -- Calculate actual duration if stage was started
  IF current_stage_record.started_at IS NOT NULL THEN
    actual_duration_minutes := EXTRACT(EPOCH FROM (current_timestamp - current_stage_record.started_at)) / 60;
  END IF;
  
  -- Mark current stage as completed
  UPDATE public.job_stage_instances
  SET 
    status = 'completed',
    completed_at = current_timestamp,
    completed_by = p_completed_by,
    actual_duration_minutes = actual_duration_minutes,
    notes = COALESCE(p_notes, notes),
    updated_at = current_timestamp,
    -- CRITICAL: Set proof approval timestamp for proof stages
    proof_approved_manually_at = CASE WHEN is_proof_stage THEN current_timestamp ELSE proof_approved_manually_at END
  WHERE id = p_current_stage_id;
  
  -- CRITICAL: Update production job with proof approval timestamp if this is a proof stage
  IF is_proof_stage THEN
    EXECUTE format('
      UPDATE %I 
      SET 
        proof_approved_at = $1,
        updated_at = $1
      WHERE id = $2
    ', p_job_table_name)
    USING current_timestamp, p_job_id;
  END IF;
  
  -- Find next stage (non-parallel processing logic for now)
  SELECT jsi.id INTO next_stage_record
  FROM public.job_stage_instances jsi
  WHERE jsi.job_id = p_job_id 
    AND jsi.job_table_name = p_job_table_name
    AND jsi.stage_order > current_stage_record.stage_order
    AND jsi.status = 'pending'
  ORDER BY jsi.stage_order ASC
  LIMIT 1;
  
  -- Activate next stage if found
  IF next_stage_record IS NOT NULL THEN
    UPDATE public.job_stage_instances
    SET 
      status = 'active',
      started_at = current_timestamp,
      started_by = p_completed_by,
      updated_at = current_timestamp
    WHERE id = next_stage_record.id;
  END IF;
  
  RETURN TRUE;
END;
$function$;

-- 2. Fix all existing jobs with missing proof approval timestamps
-- Update production_jobs.proof_approved_at based on completed proof stages
UPDATE production_jobs 
SET 
  proof_approved_at = subquery.proof_completed_at,
  updated_at = now()
FROM (
  SELECT DISTINCT
    jsi.job_id,
    jsi.completed_at as proof_completed_at
  FROM job_stage_instances jsi
  JOIN production_stages ps ON jsi.production_stage_id = ps.id
  WHERE jsi.job_table_name = 'production_jobs'
    AND jsi.status = 'completed'
    AND ps.name ILIKE '%proof%'
    AND jsi.completed_at IS NOT NULL
) as subquery
WHERE production_jobs.id = subquery.job_id
  AND production_jobs.proof_approved_at IS NULL;

-- Update job_stage_instances.proof_approved_manually_at for completed proof stages
UPDATE job_stage_instances
SET 
  proof_approved_manually_at = completed_at,
  updated_at = now()
FROM production_stages ps
WHERE job_stage_instances.production_stage_id = ps.id
  AND job_stage_instances.job_table_name = 'production_jobs' 
  AND job_stage_instances.status = 'completed'
  AND ps.name ILIKE '%proof%'
  AND job_stage_instances.completed_at IS NOT NULL
  AND job_stage_instances.proof_approved_manually_at IS NULL;

-- 3. Clear existing schedule slots for jobs that were missing proof timestamps
-- This will allow them to be rescheduled in proper FIFO order
DELETE FROM stage_time_slots 
WHERE job_id IN (
  SELECT DISTINCT pj.id
  FROM production_jobs pj
  JOIN job_stage_instances jsi ON pj.id = jsi.job_id AND jsi.job_table_name = 'production_jobs'
  JOIN production_stages ps ON jsi.production_stage_id = ps.id
  WHERE ps.name ILIKE '%proof%'
    AND jsi.status = 'completed'
    AND jsi.completed_at IS NOT NULL
    AND pj.wo_no IN ('D425893', 'D425898', 'D426511', 'D426512', 'D426513')
);

-- Clear scheduled times from job_stage_instances for these jobs
UPDATE job_stage_instances 
SET 
  scheduled_start_at = NULL,
  scheduled_end_at = NULL,
  scheduled_minutes = NULL,
  schedule_status = NULL,
  updated_at = now()
WHERE job_id IN (
  SELECT id FROM production_jobs 
  WHERE wo_no IN ('D425893', 'D425898', 'D426511', 'D426512', 'D426513')
) AND job_table_name = 'production_jobs';