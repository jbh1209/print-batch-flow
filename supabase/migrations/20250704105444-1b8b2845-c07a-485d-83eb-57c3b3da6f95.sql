-- Fix 1: Function to inject missing Batch Allocation stage into existing jobs
CREATE OR REPLACE FUNCTION public.inject_batch_allocation_stage_for_existing_jobs()
RETURNS TABLE(fixed_job_id uuid, wo_no text, category_name text, stages_added integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_record RECORD;
  batch_allocation_stage_id UUID;
  stages_count INTEGER;
  next_stage_order INTEGER;
BEGIN
  -- Find the Batch Allocation stage
  SELECT id INTO batch_allocation_stage_id
  FROM public.production_stages
  WHERE name = 'Batch Allocation'
  LIMIT 1;
  
  IF batch_allocation_stage_id IS NULL THEN
    RAISE EXCEPTION 'Batch Allocation stage not found';
  END IF;
  
  -- Find jobs that need the Batch Allocation stage injected
  FOR job_record IN
    SELECT 
      pj.id,
      pj.wo_no,
      pj.category_id,
      c.name as category_name
    FROM public.production_jobs pj
    JOIN public.categories c ON pj.category_id = c.id
    JOIN public.category_production_stages cps ON (
      cps.category_id = pj.category_id 
      AND cps.production_stage_id = batch_allocation_stage_id
    )
    LEFT JOIN public.job_stage_instances jsi ON (
      jsi.job_id = pj.id 
      AND jsi.job_table_name = 'production_jobs'
      AND jsi.production_stage_id = batch_allocation_stage_id
    )
    WHERE jsi.id IS NULL -- Job doesn't have this stage yet
      AND pj.category_id IS NOT NULL
  LOOP
    -- Get the correct stage order from category definition
    SELECT cps.stage_order INTO next_stage_order
    FROM public.category_production_stages cps
    WHERE cps.category_id = job_record.category_id
      AND cps.production_stage_id = batch_allocation_stage_id;
    
    -- Insert the missing Batch Allocation stage
    INSERT INTO public.job_stage_instances (
      job_id,
      job_table_name,
      category_id,
      production_stage_id,
      stage_order,
      status
    ) VALUES (
      job_record.id,
      'production_jobs',
      job_record.category_id,
      batch_allocation_stage_id,
      next_stage_order,
      'pending'
    );
    
    stages_count := 1;
    
    -- Return the repair result
    RETURN QUERY SELECT 
      job_record.id,
      job_record.wo_no,
      job_record.category_name,
      stages_count;
  END LOOP;
END;
$$;

-- Fix 2: Function to properly advance job from proof to batch allocation
CREATE OR REPLACE FUNCTION public.advance_job_to_batch_allocation(
  p_job_id uuid,
  p_job_table_name text DEFAULT 'production_jobs',
  p_completed_by uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  proof_stage_id uuid;
  batch_allocation_stage_id uuid;
  current_proof_stage_instance_id uuid;
BEGIN
  -- Find the proof stage that's currently active for this job
  SELECT jsi.id, jsi.production_stage_id INTO current_proof_stage_instance_id, proof_stage_id
  FROM public.job_stage_instances jsi
  JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
  WHERE jsi.job_id = p_job_id
    AND jsi.job_table_name = p_job_table_name
    AND jsi.status = 'active'
    AND ps.name ILIKE '%proof%'
  LIMIT 1;
  
  IF current_proof_stage_instance_id IS NULL THEN
    RAISE EXCEPTION 'No active proof stage found for job %', p_job_id;
  END IF;
  
  -- Find the Batch Allocation stage
  SELECT id INTO batch_allocation_stage_id
  FROM public.production_stages
  WHERE name = 'Batch Allocation'
  LIMIT 1;
  
  IF batch_allocation_stage_id IS NULL THEN
    RAISE EXCEPTION 'Batch Allocation stage not found';
  END IF;
  
  -- Complete the proof stage
  UPDATE public.job_stage_instances
  SET 
    status = 'completed',
    completed_at = now(),
    completed_by = p_completed_by,
    updated_at = now()
  WHERE id = current_proof_stage_instance_id;
  
  -- Activate the Batch Allocation stage
  UPDATE public.job_stage_instances
  SET 
    status = 'active',
    started_at = now(),
    started_by = p_completed_by,
    updated_at = now()
  WHERE job_id = p_job_id
    AND job_table_name = p_job_table_name
    AND production_stage_id = batch_allocation_stage_id
    AND status = 'pending';
  
  -- Mark job as ready for batching but preserve original WO number
  UPDATE public.production_jobs
  SET 
    batch_ready = true,
    batch_allocated_at = now(),
    batch_allocated_by = p_completed_by,
    status = 'Ready for Batch',
    updated_at = now()
  WHERE id = p_job_id;
  
  RETURN true;
END;
$$;

-- Fix 3: Function to create proper batch master job preserving original WO numbers
CREATE OR REPLACE FUNCTION public.create_batch_master_job(
  p_batch_id uuid,
  p_constituent_job_ids uuid[],
  p_created_by uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  master_job_id uuid;
  primary_job_record RECORD;
  job_count integer;
  batch_name text;
BEGIN
  -- Get the primary job details (first job in the array)
  SELECT * INTO primary_job_record
  FROM public.production_jobs
  WHERE id = p_constituent_job_ids[1];
  
  IF primary_job_record IS NULL THEN
    RAISE EXCEPTION 'Primary job not found';
  END IF;
  
  -- Get batch name
  SELECT name INTO batch_name
  FROM public.batches
  WHERE id = p_batch_id;
  
  job_count := array_length(p_constituent_job_ids, 1);
  
  -- Create batch master job preserving primary job's WO number
  INSERT INTO public.production_jobs (
    wo_no,
    customer,
    reference,
    status,
    category_id,
    batch_category,
    user_id,
    qty,
    due_date,
    is_batch_master,
    batch_ready
  ) VALUES (
    primary_job_record.wo_no || '-BATCH',
    'BATCH: ' || COALESCE(primary_job_record.customer, 'Multiple Customers'),
    format('Batch master for %s jobs: %s', job_count, batch_name),
    'In Batch Processing',
    primary_job_record.category_id,
    batch_name,
    p_created_by,
    job_count,
    primary_job_record.due_date,
    true,
    false
  )
  RETURNING id INTO master_job_id;
  
  -- Initialize workflow for batch master job
  IF primary_job_record.category_id IS NOT NULL THEN
    PERFORM public.initialize_job_stages_auto(
      master_job_id,
      'production_jobs',
      primary_job_record.category_id
    );
  END IF;
  
  -- Update batch job references to point to the master job
  UPDATE public.batch_job_references
  SET 
    batch_job_id = master_job_id,
    batch_job_table = 'production_jobs',
    status = 'in_batch',
    updated_at = now()
  WHERE batch_id = p_batch_id
    AND production_job_id = ANY(p_constituent_job_ids);
  
  -- Update constituent jobs to reflect batch processing
  UPDATE public.production_jobs
  SET 
    status = 'In Batch Processing',
    batch_ready = false,
    updated_at = now()
  WHERE id = ANY(p_constituent_job_ids);
  
  RETURN master_job_id;
END;
$$;

-- Fix 4: Update the accessible jobs function to properly handle batch allocation visibility
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
      ORDER BY jsi.job_id, jsi.stage_order ASC
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
      ORDER BY jsi.job_id, jsi.stage_order ASC
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
        usp.can_manage = true
      )
    ORDER BY pj.wo_no;
  END IF;
END;
$$;

-- Fix 5: Add is_batch_master column to production_jobs if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'production_jobs' 
    AND column_name = 'is_batch_master'
  ) THEN
    ALTER TABLE public.production_jobs 
    ADD COLUMN is_batch_master boolean DEFAULT false;
  END IF;
END
$$;