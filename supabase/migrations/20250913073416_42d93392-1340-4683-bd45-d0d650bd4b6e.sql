-- Drop the old advance_job_stage function with 4 parameters to eliminate ambiguity
-- This will leave only the newer 5-parameter version with p_completed_by support

DROP FUNCTION IF EXISTS public.advance_job_stage(uuid, text, uuid, text);

-- The newer function with 5 parameters will remain:
-- advance_job_stage(p_job_id uuid, p_job_table_name text, p_current_stage_id uuid, p_completed_by uuid, p_notes text)
-- This properly handles proof approval logic and completed_by tracking