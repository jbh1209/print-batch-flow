
-- Fix the database function to properly handle master queue permissions
-- The issue is in direct_stage_permissions CTE - it's too restrictive

DROP FUNCTION IF EXISTS public.get_user_accessible_jobs(uuid, text, text, uuid);

CREATE OR REPLACE FUNCTION public.get_user_accessible_jobs(
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
  display_stage_name text
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
      SELECT DISTINCT ON (jsi.job_id)
        jsi.job_id,
        jsi.production_stage_id as current_stage_id,
        jsi.status as current_stage_status,
        jsi.category_id
      FROM public.job_stage_instances jsi
      WHERE jsi.job_table_name = 'production_jobs'
        AND jsi.status IN ('active', 'pending')
      ORDER BY jsi.job_id, jsi.stage_order ASC
    )
    SELECT 
      pj.id::uuid as job_id,
      COALESCE(pj.wo_no, '')::text,
      COALESCE(pj.customer, 'Unknown')::text as customer,
      COALESCE(pj.status, 'Unknown')::text as status,
      COALESCE(pj.due_date::text, '')::text as due_date,
      COALESCE(pj.reference, '')::text as reference,
      pj.category_id::uuid,
      COALESCE(c.name, '')::text as category_name,
      COALESCE(c.color, '')::text as category_color,
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
      COALESCE(mq.name, ps.name, 'No Stage')::text as display_stage_name
    FROM public.production_jobs pj
    LEFT JOIN job_current_stages jcs ON pj.id = jcs.job_id
    LEFT JOIN job_stage_counts jsc ON pj.id = jsc.job_id
    LEFT JOIN public.production_stages ps ON jcs.current_stage_id = ps.id
    LEFT JOIN public.production_stages mq ON ps.master_queue_id = mq.id
    LEFT JOIN public.categories c ON pj.category_id = c.id
    WHERE 
      (p_status_filter = 'completed' OR (p_status_filter IS NULL AND pj.status != 'Completed') OR (p_status_filter IS NOT NULL AND p_status_filter != 'completed' AND pj.status = p_status_filter))
      AND (p_stage_filter IS NULL OR jcs.current_stage_id = p_stage_filter)
    ORDER BY pj.wo_no;
  ELSE
    -- Non-admin users - FIXED: Get ALL user permissions first, then expand master queues
    RETURN QUERY
    WITH user_groups AS (
      SELECT ugm.group_id
      FROM public.user_group_memberships ugm
      WHERE ugm.user_id = p_user_id
    ),
    -- FIXED: Get ALL stage permissions (not filtered by permission type yet)
    all_user_stage_permissions AS (
      SELECT DISTINCT
        ugsp.production_stage_id,
        BOOL_OR(ugsp.can_view) as can_view,
        BOOL_OR(ugsp.can_edit) as can_edit,
        BOOL_OR(ugsp.can_work) as can_work,
        BOOL_OR(ugsp.can_manage) as can_manage
      FROM public.user_group_stage_permissions ugsp
      INNER JOIN user_groups ug ON ugsp.user_group_id = ug.group_id
      GROUP BY ugsp.production_stage_id
    ),
    -- Find all master queues the user has access to
    accessible_master_queues AS (
      SELECT 
        ausp.production_stage_id as master_queue_id,
        ausp.can_view,
        ausp.can_edit,
        ausp.can_work,
        ausp.can_manage
      FROM all_user_stage_permissions ausp
      -- Only consider stages that ARE master queues (have no master_queue_id themselves)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.production_stages ps_check 
        WHERE ps_check.id = ausp.production_stage_id 
        AND ps_check.master_queue_id IS NOT NULL
      )
    ),
    -- Expand permissions to ALL subsidiary stages of accessible master queues
    expanded_stage_permissions AS (
      -- Include all directly accessible stages
      SELECT 
        ausp.production_stage_id,
        ausp.can_view,
        ausp.can_edit,
        ausp.can_work,
        ausp.can_manage,
        'direct'::text as permission_source
      FROM all_user_stage_permissions ausp
      
      UNION ALL
      
      -- Include ALL subsidiary stages of accessible master queues
      SELECT 
        ps.id as production_stage_id,
        amq.can_view,
        amq.can_edit,
        amq.can_work,
        amq.can_manage,
        'master_queue'::text as permission_source
      FROM public.production_stages ps
      INNER JOIN accessible_master_queues amq ON ps.master_queue_id = amq.master_queue_id
      WHERE ps.is_active = true
        AND ps.master_queue_id IS NOT NULL
    ),
    -- Aggregate all permissions and THEN filter by requested permission type
    final_stage_permissions AS (
      SELECT 
        esp.production_stage_id,
        BOOL_OR(esp.can_view) as can_view,
        BOOL_OR(esp.can_edit) as can_edit,
        BOOL_OR(esp.can_work) as can_work,
        BOOL_OR(esp.can_manage) as can_manage
      FROM expanded_stage_permissions esp
      GROUP BY esp.production_stage_id
      -- FIXED: Apply permission filter AFTER expansion
      HAVING (
        (p_permission_type = 'view' AND BOOL_OR(esp.can_view) = true) OR
        (p_permission_type = 'edit' AND BOOL_OR(esp.can_edit) = true) OR
        (p_permission_type = 'work' AND BOOL_OR(esp.can_work) = true) OR
        (p_permission_type = 'manage' AND BOOL_OR(esp.can_manage) = true)
      )
    ),
    accessible_jobs AS (
      SELECT DISTINCT ON (jsi.job_id)
        jsi.job_id,
        jsi.production_stage_id as current_stage_id,
        jsi.status as current_stage_status,
        jsi.category_id,
        fsp.can_view,
        fsp.can_edit,
        fsp.can_work,
        fsp.can_manage
      FROM public.job_stage_instances jsi
      INNER JOIN final_stage_permissions fsp ON jsi.production_stage_id = fsp.production_stage_id
      WHERE jsi.job_table_name = 'production_jobs'
        AND jsi.status IN ('active', 'pending')
      ORDER BY jsi.job_id, jsi.stage_order ASC
    ),
    job_stage_counts AS (
      SELECT 
        aj_jsi.job_id,
        COUNT(*)::integer as total_stages,
        COUNT(CASE WHEN aj_jsi.status = 'completed' THEN 1 END)::integer as completed_stages
      FROM public.job_stage_instances aj_jsi
      WHERE aj_jsi.job_table_name = 'production_jobs'
        AND aj_jsi.job_id IN (SELECT aj_inner.job_id FROM accessible_jobs aj_inner)
      GROUP BY aj_jsi.job_id
    )
    SELECT 
      pj.id::uuid as job_id,
      COALESCE(pj.wo_no, '')::text,
      COALESCE(pj.customer, 'Unknown')::text as customer,
      COALESCE(pj.status, 'Unknown')::text as status,
      COALESCE(pj.due_date::text, '')::text as due_date,
      COALESCE(pj.reference, '')::text as reference,
      pj.category_id::uuid,
      COALESCE(c.name, '')::text as category_name,
      COALESCE(c.color, '')::text as category_color,
      aj.current_stage_id::uuid,
      COALESCE(ps.name, '')::text as current_stage_name,
      COALESCE(ps.color, '')::text as current_stage_color,
      COALESCE(aj.current_stage_status, '')::text,
      COALESCE(aj.can_view, false)::boolean as user_can_view,
      COALESCE(aj.can_edit, false)::boolean as user_can_edit,
      COALESCE(aj.can_work, false)::boolean as user_can_work,
      COALESCE(aj.can_manage, false)::boolean as user_can_manage,
      CASE 
        WHEN COALESCE(jsc.total_stages, 0) > 0 THEN 
          ROUND((COALESCE(jsc.completed_stages, 0)::float / jsc.total_stages::float) * 100)::integer
        ELSE 0 
      END::integer as workflow_progress,
      COALESCE(jsc.total_stages, 0)::integer as total_stages,
      COALESCE(jsc.completed_stages, 0)::integer as completed_stages,
      COALESCE(mq.name, ps.name, '')::text as display_stage_name
    FROM public.production_jobs pj
    INNER JOIN accessible_jobs aj ON pj.id = aj.job_id
    LEFT JOIN job_stage_counts jsc ON pj.id = jsc.job_id
    LEFT JOIN public.production_stages ps ON aj.current_stage_id = ps.id
    LEFT JOIN public.production_stages mq ON ps.master_queue_id = mq.id
    LEFT JOIN public.categories c ON pj.category_id = c.id
    WHERE 
      (p_status_filter = 'completed' OR (p_status_filter IS NULL AND pj.status != 'Completed') OR (p_status_filter IS NOT NULL AND p_status_filter != 'completed' AND pj.status = p_status_filter))
      AND (p_stage_filter IS NULL OR aj.current_stage_id = p_stage_filter)
    ORDER BY pj.wo_no;
  END IF;
END;
$$;
