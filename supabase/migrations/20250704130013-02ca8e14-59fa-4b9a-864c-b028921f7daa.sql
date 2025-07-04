-- Fix the accessible jobs function to properly detect active Batch Allocation stage
CREATE OR REPLACE FUNCTION public.get_user_accessible_jobs_with_batch_allocation(
  p_user_id uuid DEFAULT auth.uid(),
  p_permission_type text DEFAULT 'work',
  p_status_filter text DEFAULT NULL,
  p_stage_filter uuid DEFAULT NULL
)
RETURNS TABLE(
  job_id uuid, wo_no text, customer text, status text, due_date text, 
  reference text, category_id uuid, category_name text, category_color text,
  current_stage_id uuid, current_stage_name text, current_stage_color text,
  current_stage_status text, user_can_view boolean, user_can_edit boolean,
  user_can_work boolean, user_can_manage boolean, workflow_progress integer,
  total_stages integer, completed_stages integer, display_stage_name text,
  qty integer, started_by uuid, started_by_name text, proof_emailed_at text,
  is_conditional_stage boolean, stage_should_show boolean, batch_ready boolean,
  is_batch_master boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
      -- Prioritize active stages first, then pending stages
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
            -- Show batch allocation if job is batch_ready OR is_batch_master
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
      COALESCE(pj.is_batch_master, false)::boolean as is_batch_master
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
      AND (bav.should_show IS NULL OR bav.should_show = true)
    ORDER BY pj.wo_no;
  ELSE
    -- Non-admin logic with similar batch allocation visibility
    RETURN QUERY
    WITH user_groups AS (
      SELECT ugm.group_id
      FROM public.user_group_memberships ugm
      WHERE ugm.user_id = p_user_id
    ),
    user_stage_permissions AS (
      SELECT DISTINCT
        ugsp.production_stage_id,
        BOOL_OR(ugsp.can_view) as can_view,
        BOOL_OR(ugsp.can_edit) as can_edit,
        BOOL_OR(ugsp.can_work) as can_work,
        BOOL_OR(ugsp.can_manage) as can_manage
      FROM public.user_group_stage_permissions ugsp
      WHERE ugsp.user_group_id IN (SELECT group_id FROM user_groups)
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
      -- Prioritize active stages first, then pending stages
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
      COALESCE(usp.can_view, false)::boolean as user_can_view,
      COALESCE(usp.can_edit, false)::boolean as user_can_edit,
      COALESCE(usp.can_work, false)::boolean as user_can_work,
      COALESCE(usp.can_manage, false)::boolean as user_can_manage,
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
      COALESCE(pj.is_batch_master, false)::boolean as is_batch_master
    FROM public.production_jobs pj
    LEFT JOIN job_current_stages jcs ON pj.id = jcs.job_id
    LEFT JOIN job_stage_counts jsc ON pj.id = jsc.job_id
    LEFT JOIN public.production_stages ps ON jcs.current_stage_id = ps.id
    LEFT JOIN public.production_stages mq ON ps.master_queue_id = mq.id
    LEFT JOIN public.categories c ON pj.category_id = c.id
    LEFT JOIN public.profiles p ON jcs.started_by = p.id
    LEFT JOIN user_stage_permissions usp ON jcs.current_stage_id = usp.production_stage_id
    LEFT JOIN batch_allocation_visibility bav ON pj.id = bav.job_id
    WHERE 
      (p_status_filter = 'completed' OR (p_status_filter IS NULL AND pj.status != 'Completed') OR (p_status_filter IS NOT NULL AND p_status_filter != 'completed' AND pj.status = p_status_filter))
      AND (p_stage_filter IS NULL OR jcs.current_stage_id = p_stage_filter)
      AND (bav.should_show IS NULL OR bav.should_show = true)
      AND (
        usp.can_view = true OR 
        usp.can_edit = true OR 
        usp.can_work = true OR 
        usp.can_manage = true OR
        p_user_id IS NULL  -- Allow null user for testing
      )
    ORDER BY pj.wo_no;
  END IF;
END;
$$;