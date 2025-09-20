-- Fix the get_user_accessible_jobs RPC to properly include started_by_name
CREATE OR REPLACE FUNCTION public.get_user_accessible_jobs(
    p_user_id uuid DEFAULT NULL,
    p_permission_type text DEFAULT 'work',
    p_status_filter text DEFAULT NULL,
    p_stage_filter text DEFAULT NULL
)
RETURNS TABLE (
    job_id uuid,
    id uuid,
    wo_no text,
    customer text,
    status text,
    due_date timestamp with time zone,
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
    workflow_progress numeric,
    total_stages integer,
    completed_stages integer,
    display_stage_name text,
    qty integer,
    has_custom_workflow boolean,
    manual_due_date timestamp with time zone,
    batch_category text,
    proof_emailed_at timestamp with time zone,
    started_by uuid,
    started_by_name text,
    contact text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    job_record RECORD;
    current_stage_record RECORD;
    stage_instance_record RECORD;
    latest_started_record RECORD;
BEGIN
    -- Loop through accessible jobs based on user permissions
    FOR job_record IN
        SELECT DISTINCT
            pj.id,
            pj.wo_no,
            pj.customer,
            pj.status,
            pj.due_date,
            pj.reference,
            pj.category_id,
            COALESCE(pc.name, 'Uncategorized') as category_name,
            COALESCE(pc.color, '#6B7280') as category_color,
            pj.qty,
            pj.has_custom_workflow,
            pj.manual_due_date,
            pj.batch_category,
            pj.proof_approved_at as proof_emailed_at,
            pj.contact
        FROM production_jobs pj
        LEFT JOIN production_categories pc ON pc.id = pj.category_id
        LEFT JOIN job_stage_instances jsi ON jsi.job_id = pj.id
        LEFT JOIN production_stage_permissions psp ON psp.stage_id = jsi.production_stage_id
        WHERE 
            (p_user_id IS NULL OR 
             psp.user_id = p_user_id OR
             auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin'))
        AND (p_status_filter IS NULL OR pj.status = p_status_filter)
    LOOP
        -- Get current active stage for this job
        SELECT 
            jsi.production_stage_id as current_stage_id,
            ps.name as current_stage_name,
            ps.color as current_stage_color,
            jsi.status as current_stage_status,
            ps.stage_order
        INTO current_stage_record
        FROM job_stage_instances jsi
        JOIN production_stages ps ON ps.id = jsi.production_stage_id
        WHERE jsi.job_id = job_record.id 
        AND jsi.status IN ('pending', 'active')
        ORDER BY ps.stage_order ASC
        LIMIT 1;

        -- Get the most recent started_by information for this job
        SELECT 
            jsi.started_by,
            p.full_name as started_by_name
        INTO latest_started_record
        FROM job_stage_instances jsi
        LEFT JOIN profiles p ON p.id = jsi.started_by
        WHERE jsi.job_id = job_record.id 
        AND jsi.started_by IS NOT NULL
        ORDER BY jsi.started_at DESC
        LIMIT 1;

        -- Calculate workflow progress
        SELECT 
            COUNT(*) as total_stages,
            SUM(CASE WHEN jsi.status = 'completed' THEN 1 ELSE 0 END) as completed_stages
        INTO stage_instance_record
        FROM job_stage_instances jsi
        WHERE jsi.job_id = job_record.id;

        -- Return the job data
        RETURN QUERY VALUES (
            job_record.id, -- job_id
            job_record.id, -- id
            job_record.wo_no,
            job_record.customer,
            job_record.status,
            job_record.due_date,
            job_record.reference,
            job_record.category_id,
            job_record.category_name,
            job_record.category_color,
            current_stage_record.current_stage_id,
            COALESCE(current_stage_record.current_stage_name, 'No Active Stage'),
            COALESCE(current_stage_record.current_stage_color, '#6B7280'),
            COALESCE(current_stage_record.current_stage_status, 'pending'),
            true, -- user_can_view
            true, -- user_can_edit  
            true, -- user_can_work
            true, -- user_can_manage
            CASE 
                WHEN stage_instance_record.total_stages > 0 
                THEN ROUND((stage_instance_record.completed_stages::numeric / stage_instance_record.total_stages::numeric) * 100, 1)
                ELSE 0 
            END, -- workflow_progress
            COALESCE(stage_instance_record.total_stages, 0),
            COALESCE(stage_instance_record.completed_stages, 0),
            COALESCE(current_stage_record.current_stage_name, 'No Active Stage'),
            COALESCE(job_record.qty, 0),
            COALESCE(job_record.has_custom_workflow, false),
            job_record.manual_due_date,
            job_record.batch_category,
            job_record.proof_emailed_at,
            latest_started_record.started_by,
            latest_started_record.started_by_name,
            job_record.contact
        );
    END LOOP;
END;
$$;