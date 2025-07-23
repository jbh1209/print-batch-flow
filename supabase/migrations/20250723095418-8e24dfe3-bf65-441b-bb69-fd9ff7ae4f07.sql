
-- Create stage_groups table to define groups of stages that can work together
CREATE TABLE public.stage_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  parallel_processing_enabled boolean NOT NULL DEFAULT false,
  color text DEFAULT '#6B7280',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add stage_group_id to production_stages table
ALTER TABLE public.production_stages 
ADD COLUMN stage_group_id uuid REFERENCES public.stage_groups(id);

-- Add part_assignment to job_stage_instances table
ALTER TABLE public.job_stage_instances 
ADD COLUMN part_assignment text DEFAULT 'both' CHECK (part_assignment IN ('cover', 'text', 'both', 'none'));

-- Create RLS policies for stage_groups
ALTER TABLE public.stage_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage stage groups" 
  ON public.stage_groups 
  FOR ALL 
  USING (is_admin_simple())
  WITH CHECK (is_admin_simple());

CREATE POLICY "All users can view stage groups" 
  ON public.stage_groups 
  FOR SELECT 
  USING (true);

-- Insert default stage groups
INSERT INTO public.stage_groups (name, description, parallel_processing_enabled, color) VALUES
('Printing', 'Printing operations that can run in parallel on different printers', true, '#3B82F6'),
('Finishing', 'Finishing operations that can run in parallel', true, '#10B981'),
('Binding', 'Binding operations that must run sequentially', false, '#8B5CF6'),
('Quality Control', 'Quality control and approval stages', false, '#F59E0B'),
('Delivery', 'Delivery and dispatch operations', false, '#EF4444');

-- Update the initialize_job_stages_auto function to NOT auto-activate first stage
CREATE OR REPLACE FUNCTION public.initialize_job_stages_auto(p_job_id uuid, p_job_table_name text, p_category_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  stage_record RECORD;
BEGIN
  -- Create stage instances for each stage in the category (ALL starting as pending)
  FOR stage_record IN
    SELECT 
      cps.production_stage_id,
      cps.stage_order,
      cps.estimated_duration_hours,
      ps.running_speed_per_hour,
      ps.make_ready_time_minutes,
      ps.speed_unit
    FROM public.category_production_stages cps
    JOIN public.production_stages ps ON cps.production_stage_id = ps.id
    WHERE cps.category_id = p_category_id
      AND ps.is_active = true
    ORDER BY cps.stage_order ASC
  LOOP
    INSERT INTO public.job_stage_instances (
      job_id,
      job_table_name,
      category_id,
      production_stage_id,
      stage_order,
      status,
      part_assignment,
      quantity,
      estimated_duration_minutes,
      setup_time_minutes
    ) VALUES (
      p_job_id,
      p_job_table_name,
      p_category_id,
      stage_record.production_stage_id,
      stage_record.stage_order,
      'pending', -- ALL stages start as pending - NO auto-activation
      'both', -- Default part assignment
      NULL, -- Will be set later when quantities are assigned
      NULL, -- Will be calculated when quantities are assigned
      COALESCE(stage_record.make_ready_time_minutes, 10) -- Default setup time
    );
  END LOOP;
  
  RETURN TRUE;
END;
$function$;

-- Update advance_job_stage function to handle parallel processing within groups
CREATE OR REPLACE FUNCTION public.advance_job_stage_with_groups(
  p_job_id uuid, 
  p_job_table_name text, 
  p_current_stage_id uuid, 
  p_completed_by uuid DEFAULT auth.uid(),
  p_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  current_stage_record RECORD;
  actual_duration_minutes INTEGER;
  next_stage_record RECORD;
  current_group_id uuid;
  parallel_enabled boolean;
BEGIN
  -- Get the current stage instance
  SELECT jsi.*, ps.stage_group_id INTO current_stage_record
  FROM public.job_stage_instances jsi
  JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
  WHERE jsi.job_id = p_job_id 
    AND jsi.job_table_name = p_job_table_name
    AND jsi.id = p_current_stage_id
    AND jsi.status = 'active';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Current stage not found or not active';
  END IF;
  
  -- Calculate actual duration if stage was started
  IF current_stage_record.started_at IS NOT NULL THEN
    actual_duration_minutes := EXTRACT(EPOCH FROM (now() - current_stage_record.started_at)) / 60;
  END IF;
  
  -- Mark current stage as completed
  UPDATE public.job_stage_instances
  SET 
    status = 'completed',
    completed_at = now(),
    completed_by = p_completed_by,
    actual_duration_minutes = actual_duration_minutes,
    notes = COALESCE(p_notes, notes),
    updated_at = now()
  WHERE id = p_current_stage_id;
  
  -- Get group information for parallel processing logic
  SELECT sg.id, sg.parallel_processing_enabled INTO current_group_id, parallel_enabled
  FROM public.stage_groups sg
  WHERE sg.id = current_stage_record.stage_group_id;
  
  -- Check if there are other stages in the same group that can be activated
  IF parallel_enabled AND current_group_id IS NOT NULL THEN
    -- Look for other pending stages in the same group and same order
    FOR next_stage_record IN
      SELECT jsi.id
      FROM public.job_stage_instances jsi
      JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
      WHERE jsi.job_id = p_job_id 
        AND jsi.job_table_name = p_job_table_name
        AND jsi.stage_order = current_stage_record.stage_order
        AND jsi.status = 'pending'
        AND ps.stage_group_id = current_group_id
    LOOP
      -- These stages remain pending - operator must manually start them
      -- We don't auto-activate anything anymore
      NULL;
    END LOOP;
  END IF;
  
  -- Find next sequential stage (different stage_order)
  SELECT jsi.id INTO next_stage_record
  FROM public.job_stage_instances jsi
  WHERE jsi.job_id = p_job_id 
    AND jsi.job_table_name = p_job_table_name
    AND jsi.stage_order > current_stage_record.stage_order
    AND jsi.status = 'pending'
  ORDER BY jsi.stage_order ASC
  LIMIT 1;
  
  -- Next stage remains pending - operator must manually start it
  -- We don't auto-activate anything anymore
  
  RETURN TRUE;
END;
$function$;

-- Create function to get available stages for activation based on group rules
CREATE OR REPLACE FUNCTION public.get_available_stages_for_activation(
  p_job_id uuid, 
  p_job_table_name text
)
RETURNS TABLE(
  stage_id uuid,
  stage_name text,
  stage_order integer,
  part_assignment text,
  can_activate boolean,
  blocking_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    jsi.id as stage_id,
    ps.name as stage_name,
    jsi.stage_order,
    jsi.part_assignment,
    CASE 
      WHEN jsi.status != 'pending' THEN false
      WHEN EXISTS (
        SELECT 1 FROM public.job_stage_instances prev_jsi
        WHERE prev_jsi.job_id = p_job_id 
          AND prev_jsi.job_table_name = p_job_table_name
          AND prev_jsi.stage_order < jsi.stage_order
          AND prev_jsi.status NOT IN ('completed', 'skipped')
      ) THEN false
      ELSE true
    END as can_activate,
    CASE 
      WHEN jsi.status != 'pending' THEN 'Stage is ' || jsi.status
      WHEN EXISTS (
        SELECT 1 FROM public.job_stage_instances prev_jsi
        WHERE prev_jsi.job_id = p_job_id 
          AND prev_jsi.job_table_name = p_job_table_name
          AND prev_jsi.stage_order < jsi.stage_order
          AND prev_jsi.status NOT IN ('completed', 'skipped')
      ) THEN 'Previous stages must be completed first'
      ELSE 'Ready to start'
    END as blocking_reason
  FROM public.job_stage_instances jsi
  JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
  WHERE jsi.job_id = p_job_id 
    AND jsi.job_table_name = p_job_table_name
  ORDER BY jsi.stage_order;
END;
$function$;
