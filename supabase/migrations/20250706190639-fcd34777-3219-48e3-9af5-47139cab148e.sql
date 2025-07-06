-- Fix Permission Filtering Bug in get_user_accessible_jobs_with_conditional_stages
-- Issue: The OR ausp.production_stage_id IS NULL condition allows users to see jobs they shouldn't have access to
-- Solution: Remove the OR condition and use INNER JOIN for stricter permission filtering

DROP FUNCTION IF EXISTS public.get_user_accessible_jobs_with_conditional_stages(uuid, text, text, uuid);

CREATE OR REPLACE FUNCTION public.get_user_accessible_jobs_with_conditional_stages(
  p_user_id uuid DEFAULT auth.uid(),
  p_permission_type text DEFAULT 'work'::text,
  p_status_filter text DEFAULT NULL::text,
  p_stage_filter uuid DEFAULT NULL::uuid
) RETURNS TABLE(
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
  display_stage_name text,
  user_can_view boolean,
  user_can_edit boolean,
  user_can_work boolean,
  user_can_manage boolean,
  workflow_progress integer,
  total_stages integer,
  completed_stages integer,
  qty integer,
  started_by uuid,
  started_by_name text,
  proof_emailed_at text,
  -- Concurrent part fields
  part_name text,
  concurrent_stage_group_id uuid,
  is_concurrent_part boolean
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Check if user is admin - admins can see everything
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
      -- For concurrent stages, return multiple records
      SELECT DISTINCT
        jsi.job_id,
        jsi.production_stage_id as current_stage_id,
        jsi.status as current_stage_status,
        jsi.category_id,
        jsi.started_by,
        jsi.proof_emailed_at,
        jsi.part_name,
        jsi.concurrent_stage_group_id,
        CASE WHEN jsi.concurrent_stage_group_id IS NOT NULL THEN true ELSE false END as is_concurrent_part,
        -- For concurrent stages, prioritize active ones, then pending
        ROW_NUMBER() OVER (
          PARTITION BY jsi.job_id, COALESCE(jsi.concurrent_stage_group_id::text, jsi.production_stage_id::text)
          ORDER BY 
            CASE WHEN jsi.status = 'active' THEN 1 
                 WHEN jsi.status = 'pending' THEN 2 
                 ELSE 3 END,
            jsi.stage_order ASC
        ) as stage_priority
      FROM public.job_stage_instances jsi
      WHERE jsi.job_table_name = 'production_jobs'
        AND jsi.status IN ('active', 'pending')
    ),
    filtered_current_stages AS (
      SELECT * FROM job_current_stages 
      WHERE stage_priority = 1
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
      COALESCE(mq.name, ps.name, 'No Stage')::text as display_stage_name,
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
      COALESCE(pj.qty, 0)::integer as qty,
      jcs.started_by::uuid,
      COALESCE(p.full_name, 'Unknown')::text as started_by_name,
      COALESCE(jcs.proof_emailed_at::text, '')::text as proof_emailed_at,
      -- Concurrent part fields
      jcs.part_name::text,
      jcs.concurrent_stage_group_id::uuid,
      jcs.is_concurrent_part::boolean
    FROM public.production_jobs pj
    LEFT JOIN filtered_current_stages jcs ON pj.id = jcs.job_id
    LEFT JOIN job_stage_counts jsc ON pj.id = jsc.job_id
    LEFT JOIN public.production_stages ps ON jcs.current_stage_id = ps.id
    LEFT JOIN public.production_stages mq ON ps.master_queue_id = mq.id
    LEFT JOIN public.categories c ON pj.category_id = c.id
    LEFT JOIN public.profiles p ON jcs.started_by = p.id
    WHERE 
      (p_status_filter = 'completed' OR (p_status_filter IS NULL AND pj.status != 'Completed') OR (p_status_filter IS NOT NULL AND p_status_filter != 'completed' AND pj.status = p_status_filter))
      AND (p_stage_filter IS NULL OR jcs.current_stage_id = p_stage_filter)
    ORDER BY pj.wo_no, jcs.part_name NULLS FIRST;
  ELSE
    -- For regular users, apply STRICT permission filtering
    RETURN QUERY
    WITH user_groups AS (
      SELECT ugm.group_id
      FROM public.user_group_memberships ugm
      WHERE ugm.user_id = p_user_id
    ),
    all_user_stage_permissions AS (
      SELECT DISTINCT
        ugsp.production_stage_id,
        BOOL_OR(
          CASE 
            WHEN p_permission_type = 'view' THEN ugsp.can_view
            WHEN p_permission_type = 'edit' THEN ugsp.can_edit
            WHEN p_permission_type = 'work' THEN ugsp.can_work
            WHEN p_permission_type = 'manage' THEN ugsp.can_manage
            ELSE false
          END
        ) as has_permission,
        BOOL_OR(ugsp.can_view) as can_view,
        BOOL_OR(ugsp.can_edit) as can_edit,
        BOOL_OR(ugsp.can_work) as can_work,
        BOOL_OR(ugsp.can_manage) as can_manage
      FROM public.user_group_stage_permissions ugsp
      INNER JOIN user_groups ug ON ugsp.user_group_id = ug.group_id
      GROUP BY ugsp.production_stage_id
    ),
    job_stage_counts AS (
      SELECT 
        jsi.job_id,
        COUNT(*)::integer as total_stages,
        COUNT(CASE WHEN jsi.status = 'completed' THEN 1 END)::integer as completed_stages
      FROM public.job_stage_instances jsi
      WHERE jsi.job_table_name = 'production_jobs'
      GROUP BY jsi.job_id
    ),
    job_current_stages AS (
      -- For concurrent stages, return multiple records with STRICT permission filtering
      SELECT DISTINCT
        jsi.job_id,
        jsi.production_stage_id as current_stage_id,
        jsi.status as current_stage_status,
        jsi.category_id,
        jsi.started_by,
        jsi.proof_emailed_at,
        jsi.part_name,
        jsi.concurrent_stage_group_id,
        CASE WHEN jsi.concurrent_stage_group_id IS NOT NULL THEN true ELSE false END as is_concurrent_part,
        ausp.can_view,
        ausp.can_edit, 
        ausp.can_work,
        ausp.can_manage,
        -- For concurrent stages, prioritize active ones, then pending
        ROW_NUMBER() OVER (
          PARTITION BY jsi.job_id, COALESCE(jsi.concurrent_stage_group_id::text, jsi.production_stage_id::text)
          ORDER BY 
            CASE WHEN jsi.status = 'active' THEN 1 
                 WHEN jsi.status = 'pending' THEN 2 
                 ELSE 3 END,
            jsi.stage_order ASC
        ) as stage_priority
      FROM public.job_stage_instances jsi
      -- FIXED: Use INNER JOIN to ensure only jobs with valid permissions are returned
      INNER JOIN all_user_stage_permissions ausp ON jsi.production_stage_id = ausp.production_stage_id
      WHERE jsi.job_table_name = 'production_jobs'
        AND jsi.status IN ('active', 'pending')
        -- FIXED: Remove the problematic OR condition that allowed unauthorized access
        AND ausp.has_permission = true
    ),
    filtered_current_stages AS (
      SELECT * FROM job_current_stages 
      WHERE stage_priority = 1
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
      COALESCE(mq.name, ps.name, 'No Stage')::text as display_stage_name,
      COALESCE(jcs.can_view, false)::boolean as user_can_view,
      COALESCE(jcs.can_edit, false)::boolean as user_can_edit,
      COALESCE(jcs.can_work, false)::boolean as user_can_work,
      COALESCE(jcs.can_manage, false)::boolean as user_can_manage,
      CASE 
        WHEN COALESCE(jsc.total_stages, 0) > 0 THEN 
          ROUND((COALESCE(jsc.completed_stages, 0)::float / jsc.total_stages::float) * 100)::integer
        ELSE 0 
      END::integer as workflow_progress,
      COALESCE(jsc.total_stages, 0)::integer as total_stages,
      COALESCE(jsc.completed_stages, 0)::integer as completed_stages,
      COALESCE(pj.qty, 0)::integer as qty,
      jcs.started_by::uuid,
      COALESCE(p.full_name, 'Unknown')::text as started_by_name,
      COALESCE(jcs.proof_emailed_at::text, '')::text as proof_emailed_at,
      -- Concurrent part fields
      jcs.part_name::text,
      jcs.concurrent_stage_group_id::uuid,
      jcs.is_concurrent_part::boolean
    FROM public.production_jobs pj
    -- Use INNER JOIN to ensure only jobs with accessible stages are returned
    INNER JOIN filtered_current_stages jcs ON pj.id = jcs.job_id
    LEFT JOIN job_stage_counts jsc ON pj.id = jsc.job_id
    LEFT JOIN public.production_stages ps ON jcs.current_stage_id = ps.id
    LEFT JOIN public.production_stages mq ON ps.master_queue_id = mq.id
    LEFT JOIN public.categories c ON pj.category_id = c.id
    LEFT JOIN public.profiles p ON jcs.started_by = p.id
    WHERE 
      (p_status_filter = 'completed' OR (p_status_filter IS NULL AND pj.status != 'Completed') OR (p_status_filter IS NOT NULL AND p_status_filter != 'completed' AND pj.status = p_status_filter))
      AND (p_stage_filter IS NULL OR jcs.current_stage_id = p_stage_filter)
    ORDER BY pj.wo_no, jcs.part_name NULLS FIRST;
  END IF;
END;
$$;