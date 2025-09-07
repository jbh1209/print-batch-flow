-- Fix scheduler to only process proof-approved jobs and clean up duplicate slots (corrected)

-- Step 1: Add proof approval filter to v_scheduler_stages_ready view (using correct column name)
CREATE OR REPLACE VIEW public.v_scheduler_stages_ready AS
SELECT 
  jsi.*,
  ps.name as stage_name,
  COALESCE(sg.name, 'Default') as stage_group
FROM public.job_stage_instances jsi
JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
LEFT JOIN public.stage_groups sg ON ps.stage_group_id = sg.id
JOIN public.production_jobs pj ON jsi.job_id = pj.id AND jsi.job_table_name = 'production_jobs'
WHERE jsi.status IN ('pending', 'scheduled')
  AND jsi.job_table_name = 'production_jobs'
  -- CRITICAL: Only include proof-approved jobs
  AND pj.proof_approved_at IS NOT NULL
  AND ps.is_active = true;

-- Step 2: Clean up duplicate time slots (keep only the latest one per stage instance)
WITH duplicates AS (
  SELECT 
    stage_instance_id,
    COUNT(*) as slot_count,
    array_agg(id ORDER BY created_at DESC) as slot_ids
  FROM public.stage_time_slots 
  WHERE stage_instance_id IS NOT NULL
  GROUP BY stage_instance_id
  HAVING COUNT(*) > 1
),
slots_to_delete AS (
  SELECT unnest(slot_ids[2:]) as id_to_delete
  FROM duplicates
)
DELETE FROM public.stage_time_slots 
WHERE id IN (SELECT id_to_delete FROM slots_to_delete);