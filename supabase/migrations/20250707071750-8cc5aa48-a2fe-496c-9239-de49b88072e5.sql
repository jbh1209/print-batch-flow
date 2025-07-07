-- Complete system restoration - remove all multi-part/concurrent functionality (corrected)
-- This migration undoes all concurrent workflow changes from July 6-7, 2025

-- Step 1: Remove concurrent workflow columns from job_stage_instances
ALTER TABLE public.job_stage_instances 
DROP COLUMN IF EXISTS concurrent_stage_group_id,
DROP COLUMN IF EXISTS allows_concurrent_start,
DROP COLUMN IF EXISTS requires_all_parts_complete,
DROP COLUMN IF EXISTS stage_dependency_group,
DROP COLUMN IF EXISTS part_flow_chain,
DROP COLUMN IF EXISTS part_type,
DROP COLUMN IF EXISTS part_order;

-- Step 2: Remove multi-part columns from production_stages  
ALTER TABLE public.production_stages
DROP COLUMN IF EXISTS is_multi_part,
DROP COLUMN IF EXISTS part_definitions,
DROP COLUMN IF EXISTS concurrent_group_id,
DROP COLUMN IF EXISTS dependency_group,
DROP COLUMN IF EXISTS allows_concurrent_execution;

-- Step 3: Remove multi-part columns from category_production_stages
ALTER TABLE public.category_production_stages
DROP COLUMN IF EXISTS applies_to_parts,
DROP COLUMN IF EXISTS part_mapping,
DROP COLUMN IF EXISTS part_rule_type;

-- Step 4: Clean up job_stage_instances data - remove duplicates and part-specific data
-- Keep only one instance per job per stage (the earliest created one)
DELETE FROM public.job_stage_instances jsi1
WHERE jsi1.id NOT IN (
  SELECT DISTINCT ON (jsi2.job_id, jsi2.production_stage_id) jsi2.id
  FROM public.job_stage_instances jsi2
  WHERE jsi2.job_table_name = 'production_jobs'
  ORDER BY jsi2.job_id, jsi2.production_stage_id, jsi2.created_at ASC
);

-- Clear part_name data that causes confusion
UPDATE public.job_stage_instances 
SET part_name = NULL 
WHERE job_table_name = 'production_jobs';

-- Step 5: Restore simple get_user_accessible_jobs_with_conditional_stages function
DROP FUNCTION IF EXISTS public.get_user_accessible_jobs_with_conditional_stages(uuid, text, text, uuid);

CREATE OR REPLACE FUNCTION public.get_user_accessible_jobs_with_conditional_stages(
  p_user_id uuid DEFAULT auth.uid(), 
  p_permission_type text DEFAULT 'work'::text, 
  p_status_filter text DEFAULT NULL::text, 
  p_stage_filter uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  job_id uuid, 
  wo_no text, 
  customer text, 
  status text, 
  due_date text, 
  reference text, 
  category_id uuid, 
  category_name text, 
  category_color text, 
  current_stage_id uuid, 
  current_stage_name text, 
  current_stage_color text, 
  current_stage_status text, 
  user_can_view boolean, 
  user_can_edit boolean, 
  user_can_work boolean, 
  user_can_manage boolean, 
  workflow_progress integer, 
  total_stages integer, 
  completed_stages integer, 
  display_stage_name text, 
  qty integer, 
  started_by uuid, 
  started_by_name text, 
  proof_emailed_at text, 
  is_conditional_stage boolean, 
  stage_should_show boolean, 
  batch_ready boolean, 
  is_batch_master boolean,
  part_name text,
  concurrent_stage_group_id uuid,
  is_concurrent_part boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is admin - admins get all data
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = 'admin') THEN
    RETURN QUERY
    WITH job_stage_counts AS (
      SELECT 
        jsi.job_id,
        COUNT(*)::integer as total_stages,
        COUNT(CASE WHEN jsi.status = 'completed' THEN 1 END)::integer as completed_stages
      FROM public.job_stage_instances jsi
      WHERE jsi.job_table_name = 'production_jobs'
      GROUP BY jsi.job_id
    ),
    job_current_stages AS (
      -- Simple: one current stage per job
      SELECT DISTINCT ON (jsi.job_id)
        jsi.job_id,
        jsi.production_stage_id as current_stage_id,
        jsi.status as current_stage_status,
        jsi.category_id,
        jsi.started_by,
        jsi.proof_emailed_at
      FROM public.job_stage_instances jsi
      WHERE jsi.job_table_name = 'production_jobs'
        AND jsi.status IN ('active', 'pending')
      ORDER BY jsi.job_id, 
               CASE WHEN jsi.status = 'active' THEN 0 ELSE 1 END,
               jsi.stage_order ASC
    ),
    batch_allocation_visibility AS (
      SELECT 
        jcs.job_id,
        ps.is_conditional,
        CASE 
          WHEN ps.name = 'Batch Allocation' THEN 
            (COALESCE(pj.batch_ready, false) OR COALESCE(pj.is_batch_master, false))
          ELSE true
        END as should_show
      FROM job_current_stages jcs
      JOIN public.production_stages ps ON jcs.current_stage_id = ps.id
      JOIN public.production_jobs pj ON jcs.job_id = pj.id
    )
    SELECT 
      pj.id::uuid as job_id,
      COALESCE(pj.wo_no, '')::text,
      COALESCE(pj.customer, 'Unknown')::text as customer,
      COALESCE(pj.status, 'Unknown')::text as status,
      COALESCE(pj.due_date::text, '')::text as due_date,
      COALESCE(pj.reference, '')::text as reference,
      COALESCE(pj.category_id, '00000000-0000-0000-0000-000000000000'::uuid)::uuid,
      COALESCE(c.name, 'No Category')::text as category_name,
      COALESCE(c.color, '#6B7280')::text as category_color,
      COALESCE(jcs.current_stage_id, '00000000-0000-0000-0000-000000000000'::uuid)::uuid,
      COALESCE(ps.name, 'No Stage')::text as current_stage_name,
      COALESCE(ps.color, '#6B7280')::text as current_stage_color,
      COALESCE(jcs.current_stage_status, 'pending')::text,
      true::boolean as user_can_view,
      true::boolean as user_can_edit,
      true::boolean as user_can_work,
      true::boolean as user_can_manage,
      CASE 
        WHEN COALESCE(jsc.total_stages, 0) > 0 THEN 
          ROUND((COALESCE(jsc.completed_stages, 0)::float / jsc.total_stages::float) * 100)::integer
        ELSE 0 
      END::integer as workflow_progress,
      COALESCE(jsc.total_stages, 0)::integer as total_stages,
      COALESCE(jsc.completed_stages, 0)::integer as completed_stages,
      COALESCE(mq.name, ps.name, 'No Stage')::text as display_stage_name,
      COALESCE(pj.qty, 0)::integer as qty,
      jcs.started_by::uuid,
      COALESCE(p.full_name, 'Unknown')::text as started_by_name,
      COALESCE(jcs.proof_emailed_at::text, '')::text as proof_emailed_at,
      COALESCE(ps.is_conditional, false)::boolean as is_conditional_stage,
      COALESCE(bav.should_show, true)::boolean as stage_should_show,
      COALESCE(pj.batch_ready, false)::boolean as batch_ready,
      COALESCE(pj.is_batch_master, false)::boolean as is_batch_master,
      NULL::text as part_name,
      NULL::uuid as concurrent_stage_group_id,
      false::boolean as is_concurrent_part
    FROM public.production_jobs pj
    LEFT JOIN job_current_stages jcs ON pj.id = jcs.job_id  
    LEFT JOIN job_stage_counts jsc ON pj.id = jsc.job_id
    LEFT JOIN public.production_stages ps ON jcs.current_stage_id = ps.id
    LEFT JOIN public.production_stages mq ON ps.master_queue_id = mq.id
    LEFT JOIN public.categories c ON pj.category_id = c.id
    LEFT JOIN public.profiles p ON jcs.started_by = p.id
    LEFT JOIN batch_allocation_visibility bav ON pj.id = bav.job_id
    WHERE 
      (p_status_filter = 'completed' OR (p_status_filter IS NULL AND pj.status != 'Completed') OR (p_status_filter IS NOT NULL AND p_status_filter != 'completed' AND pj.status = p_status_filter))
      AND (p_stage_filter IS NULL OR jcs.current_stage_id = p_stage_filter)
      AND COALESCE(bav.should_show, true) = true
    ORDER BY pj.wo_no;
  ELSE
    -- Non-admin users: strict permission filtering
    RETURN QUERY
    WITH user_accessible_stages AS (
      SELECT DISTINCT 
        ugsp.production_stage_id,
        BOOL_OR(ugsp.can_view) as can_view,
        BOOL_OR(ugsp.can_edit) as can_edit, 
        BOOL_OR(ugsp.can_work) as can_work,
        BOOL_OR(ugsp.can_manage) as can_manage
      FROM public.user_group_stage_permissions ugsp
      INNER JOIN public.user_group_memberships ugm ON ugsp.user_group_id = ugm.group_id
      WHERE ugm.user_id = p_user_id
      GROUP BY ugsp.production_stage_id
      HAVING (
        (p_permission_type = 'view' AND BOOL_OR(ugsp.can_view) = true) OR
        (p_permission_type = 'edit' AND BOOL_OR(ugsp.can_edit) = true) OR
        (p_permission_type = 'work' AND BOOL_OR(ugsp.can_work) = true) OR
        (p_permission_type = 'manage' AND BOOL_OR(ugsp.can_manage) = true)
      )
    ),
    accessible_through_master_queue AS (
      SELECT 
        ps.id as production_stage_id,
        uas.can_view,
        uas.can_edit,
        uas.can_work,
        uas.can_manage  
      FROM public.production_stages ps
      INNER JOIN user_accessible_stages uas ON ps.master_queue_id = uas.production_stage_id
      WHERE ps.is_active = true AND ps.master_queue_id IS NOT NULL
    ),
    all_accessible_stages AS (
      SELECT * FROM user_accessible_stages
      UNION ALL  
      SELECT * FROM accessible_through_master_queue
    ),
    final_accessible_stages AS (
      SELECT 
        production_stage_id,
        BOOL_OR(can_view) as can_view,
        BOOL_OR(can_edit) as can_edit,
        BOOL_OR(can_work) as can_work, 
        BOOL_OR(can_manage) as can_manage
      FROM all_accessible_stages
      GROUP BY production_stage_id
    ),
    accessible_jobs_with_stages AS (
      SELECT DISTINCT ON (jsi.job_id)
        jsi.job_id,
        jsi.production_stage_id as current_stage_id,
        jsi.status as current_stage_status,
        jsi.category_id,
        fas.can_view,
        fas.can_edit,
        fas.can_work,
        fas.can_manage,
        jsi.started_by,
        jsi.proof_emailed_at
      FROM public.job_stage_instances jsi
      INNER JOIN final_accessible_stages fas ON jsi.production_stage_id = fas.production_stage_id
      WHERE jsi.job_table_name = 'production_jobs'
        AND jsi.status IN ('active', 'pending')
      ORDER BY jsi.job_id, 
               CASE WHEN jsi.status = 'active' THEN 0 ELSE 1 END,
               jsi.stage_order ASC
    ),
    job_stage_counts AS (
      SELECT 
        jsi.job_id,
        COUNT(*)::integer as total_stages,
        COUNT(CASE WHEN jsi.status = 'completed' THEN 1 END)::integer as completed_stages
      FROM public.job_stage_instances jsi
      WHERE jsi.job_table_name = 'production_jobs'
        AND jsi.job_id IN (SELECT ajs.job_id FROM accessible_jobs_with_stages ajs)
      GROUP BY jsi.job_id
    ),
    batch_allocation_visibility AS (
      SELECT 
        ajs.job_id,
        ps.is_conditional,
        CASE 
          WHEN ps.name = 'Batch Allocation' THEN 
            (COALESCE(pj.batch_ready, false) OR COALESCE(pj.is_batch_master, false))
          ELSE true
        END as should_show
      FROM accessible_jobs_with_stages ajs
      JOIN public.production_stages ps ON ajs.current_stage_id = ps.id
      JOIN public.production_jobs pj ON ajs.job_id = pj.id
    )
    SELECT 
      pj.id::uuid as job_id,
      COALESCE(pj.wo_no, '')::text,
      COALESCE(pj.customer, 'Unknown')::text as customer,
      COALESCE(pj.status, 'Unknown')::text as status,
      COALESCE(pj.due_date::text, '')::text as due_date,
      COALESCE(pj.reference, '')::text as reference,
      COALESCE(pj.category_id, '00000000-0000-0000-0000-000000000000'::uuid)::uuid,
      COALESCE(c.name, 'No Category')::text as category_name,
      COALESCE(c.color, '#6B7280')::text as category_color,
      ajs.current_stage_id::uuid,
      COALESCE(ps.name, '')::text as current_stage_name,
      COALESCE(ps.color, '')::text as current_stage_color,
      COALESCE(ajs.current_stage_status, '')::text,
      COALESCE(ajs.can_view, false)::boolean as user_can_view,
      COALESCE(ajs.can_edit, false)::boolean as user_can_edit,
      COALESCE(ajs.can_work, false)::boolean as user_can_work,
      COALESCE(ajs.can_manage, false)::boolean as user_can_manage,
      CASE 
        WHEN COALESCE(jsc.total_stages, 0) > 0 THEN 
          ROUND((COALESCE(jsc.completed_stages, 0)::float / jsc.total_stages::float) * 100)::integer
        ELSE 0 
      END::integer as workflow_progress,
      COALESCE(jsc.total_stages, 0)::integer as total_stages,
      COALESCE(jsc.completed_stages, 0)::integer as completed_stages,
      COALESCE(mq.name, ps.name, '')::text as display_stage_name,
      COALESCE(pj.qty, 0)::integer as qty,
      ajs.started_by::uuid,
      COALESCE(p.full_name, 'Unknown')::text as started_by_name,
      COALESCE(ajs.proof_emailed_at::text, '')::text as proof_emailed_at,
      COALESCE(ps.is_conditional, false)::boolean as is_conditional_stage,
      COALESCE(bav.should_show, true)::boolean as stage_should_show,
      COALESCE(pj.batch_ready, false)::boolean as batch_ready,
      COALESCE(pj.is_batch_master, false)::boolean as is_batch_master,
      NULL::text as part_name,
      NULL::uuid as concurrent_stage_group_id,
      false::boolean as is_concurrent_part
    FROM public.production_jobs pj
    INNER JOIN accessible_jobs_with_stages ajs ON pj.id = ajs.job_id
    LEFT JOIN job_stage_counts jsc ON pj.id = jsc.job_id
    LEFT JOIN public.production_stages ps ON ajs.current_stage_id = ps.id
    LEFT JOIN public.production_stages mq ON ps.master_queue_id = mq.id
    LEFT JOIN public.categories c ON pj.category_id = c.id
    LEFT JOIN public.profiles p ON ajs.started_by = p.id
    LEFT JOIN batch_allocation_visibility bav ON pj.id = bav.job_id
    WHERE 
      (p_status_filter = 'completed' OR (p_status_filter IS NULL AND pj.status != 'Completed') OR (p_status_filter IS NOT NULL AND p_status_filter != 'completed' AND pj.status = p_status_filter))
      AND (p_stage_filter IS NULL OR ajs.current_stage_id = p_stage_filter)
      AND COALESCE(bav.should_show, true) = true
    ORDER BY pj.wo_no;
  END IF;
END;
$$;

-- Step 6: Remove any other concurrent workflow functions that may exist
DROP FUNCTION IF EXISTS public.advance_job_stage_with_parts(uuid, text, uuid, jsonb, uuid, text);
DROP FUNCTION IF EXISTS public.initialize_job_stages_with_parts(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.initialize_job_stages_with_part_assignments(uuid, text, uuid, jsonb);
DROP FUNCTION IF EXISTS public.get_printing_stages_for_parts();