-- PHASE 3: DATA INTEGRITY LAYER
-- Ensures scheduling system maintains data consistency and prevents data corruption

-- **INTEGRITY CONSTRAINT 1: Prevent scheduling conflicts**
-- Jobs cannot be scheduled to the same stage at overlapping times
CREATE OR REPLACE FUNCTION public.check_scheduling_conflicts()
RETURNS TRIGGER AS $$
DECLARE
  conflict_count INTEGER;
BEGIN
  -- Check for overlapping scheduled times on the same stage
  SELECT COUNT(*) INTO conflict_count
  FROM public.job_stage_instances jsi
  WHERE jsi.production_stage_id = NEW.production_stage_id
    AND jsi.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND jsi.status IN ('pending', 'active')
    AND (
      -- Check for overlap using scheduled times if available
      (NEW.auto_scheduled_start_at IS NOT NULL AND NEW.auto_scheduled_end_at IS NOT NULL
       AND jsi.auto_scheduled_start_at IS NOT NULL AND jsi.auto_scheduled_end_at IS NOT NULL
       AND NEW.auto_scheduled_start_at < jsi.auto_scheduled_end_at 
       AND NEW.auto_scheduled_end_at > jsi.auto_scheduled_start_at)
      OR
      -- Check for overlap using manual scheduled times if available  
      (NEW.scheduled_start_at IS NOT NULL AND NEW.scheduled_end_at IS NOT NULL
       AND jsi.scheduled_start_at IS NOT NULL AND jsi.scheduled_end_at IS NOT NULL
       AND NEW.scheduled_start_at < jsi.scheduled_end_at 
       AND NEW.scheduled_end_at > jsi.scheduled_start_at)
    );
  
  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'Scheduling conflict detected: Stage % already has overlapping job scheduled', NEW.production_stage_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply scheduling conflict trigger
DROP TRIGGER IF EXISTS prevent_scheduling_conflicts ON public.job_stage_instances;
CREATE TRIGGER prevent_scheduling_conflicts
  BEFORE INSERT OR UPDATE ON public.job_stage_instances
  FOR EACH ROW EXECUTE FUNCTION public.check_scheduling_conflicts();

-- **INTEGRITY CONSTRAINT 2: Capacity validation**
-- Ensure scheduled jobs don't exceed daily stage capacity
CREATE OR REPLACE FUNCTION public.validate_daily_capacity()
RETURNS TRIGGER AS $$
DECLARE
  stage_capacity_minutes INTEGER;
  used_capacity_minutes INTEGER;
  schedule_date DATE;
BEGIN
  -- Get the date being scheduled
  schedule_date := COALESCE(
    NEW.auto_scheduled_start_at::date,
    NEW.scheduled_start_at::date,
    CURRENT_DATE
  );
  
  -- Get stage daily capacity
  SELECT daily_capacity_hours * 60 INTO stage_capacity_minutes
  FROM public.stage_capacity_profiles scp
  WHERE scp.production_stage_id = NEW.production_stage_id;
  
  -- Default to 8 hours if no capacity profile exists
  stage_capacity_minutes := COALESCE(stage_capacity_minutes, 480);
  
  -- Calculate used capacity for this date and stage
  SELECT COALESCE(SUM(
    COALESCE(jsi.auto_scheduled_duration_minutes, jsi.scheduled_minutes, jsi.estimated_duration_minutes, 60)
  ), 0) INTO used_capacity_minutes
  FROM public.job_stage_instances jsi
  WHERE jsi.production_stage_id = NEW.production_stage_id
    AND jsi.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND jsi.status IN ('pending', 'active', 'completed')
    AND (
      jsi.auto_scheduled_start_at::date = schedule_date OR
      jsi.scheduled_start_at::date = schedule_date
    );
  
  -- Add current job's duration
  used_capacity_minutes := used_capacity_minutes + COALESCE(
    NEW.auto_scheduled_duration_minutes, 
    NEW.scheduled_minutes, 
    NEW.estimated_duration_minutes, 
    60
  );
  
  -- Check if capacity exceeded
  IF used_capacity_minutes > stage_capacity_minutes THEN
    RAISE EXCEPTION 'Daily capacity exceeded for stage % on %: % minutes used, % minutes available', 
      NEW.production_stage_id, schedule_date, used_capacity_minutes, stage_capacity_minutes;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply capacity validation trigger
DROP TRIGGER IF EXISTS validate_stage_capacity ON public.job_stage_instances;
CREATE TRIGGER validate_stage_capacity
  BEFORE INSERT OR UPDATE ON public.job_stage_instances
  FOR EACH ROW 
  WHEN (NEW.auto_scheduled_start_at IS NOT NULL OR NEW.scheduled_start_at IS NOT NULL)
  EXECUTE FUNCTION public.validate_daily_capacity();

-- **INTEGRITY CONSTRAINT 3: Workflow consistency**
-- Ensure stage transitions follow correct order and dependencies
CREATE OR REPLACE FUNCTION public.validate_workflow_consistency()
RETURNS TRIGGER AS $$
DECLARE
  previous_stage_completed BOOLEAN := FALSE;
  dependency_met BOOLEAN := TRUE;
  stage_order_value INTEGER;
BEGIN
  -- Get current stage order
  SELECT jsi.stage_order INTO stage_order_value
  FROM public.job_stage_instances jsi
  WHERE jsi.id = NEW.id;
  
  -- If transitioning to 'active' status, check prerequisites
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    
    -- Check if all previous stages in workflow are completed
    SELECT COALESCE(
      (SELECT COUNT(*) = 0
       FROM public.job_stage_instances jsi
       WHERE jsi.job_id = NEW.job_id
         AND jsi.job_table_name = NEW.job_table_name
         AND jsi.stage_order < stage_order_value
         AND jsi.status != 'completed'
         AND jsi.dependency_group IS NULL), -- Only check non-parallel stages
      TRUE
    ) INTO previous_stage_completed;
    
    -- Check dependency group requirements
    IF NEW.dependency_group IS NOT NULL THEN
      SELECT COALESCE(
        (SELECT COUNT(*) = 0
         FROM public.job_stage_instances jsi
         WHERE jsi.job_id = NEW.job_id
           AND jsi.job_table_name = NEW.job_table_name
           AND jsi.dependency_group = NEW.dependency_group
           AND jsi.stage_order < stage_order_value
           AND jsi.status != 'completed'),
        TRUE
      ) INTO dependency_met;
    END IF;
    
    -- Enforce workflow order (allow admin override)
    IF NOT previous_stage_completed OR NOT dependency_met THEN
      -- Check if user is admin (admins can override workflow)
      IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.started_by AND role = 'admin') THEN
        RAISE EXCEPTION 'Workflow consistency violation: Previous stages must be completed before starting stage %', NEW.production_stage_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply workflow consistency trigger
DROP TRIGGER IF EXISTS ensure_workflow_consistency ON public.job_stage_instances;
CREATE TRIGGER ensure_workflow_consistency
  BEFORE UPDATE ON public.job_stage_instances
  FOR EACH ROW EXECUTE FUNCTION public.validate_workflow_consistency();

-- **INTEGRITY CONSTRAINT 4: Data consistency checks**
-- Ensure scheduled times are logical and consistent
CREATE OR REPLACE FUNCTION public.validate_schedule_logic()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate auto-scheduled times
  IF NEW.auto_scheduled_start_at IS NOT NULL AND NEW.auto_scheduled_end_at IS NOT NULL THEN
    IF NEW.auto_scheduled_end_at <= NEW.auto_scheduled_start_at THEN
      RAISE EXCEPTION 'Invalid auto-schedule: End time must be after start time';
    END IF;
    
    -- Check if duration matches calculated duration
    IF NEW.auto_scheduled_duration_minutes IS NOT NULL THEN
      IF ABS(EXTRACT(EPOCH FROM (NEW.auto_scheduled_end_at - NEW.auto_scheduled_start_at)) / 60 - NEW.auto_scheduled_duration_minutes) > 1 THEN
        RAISE EXCEPTION 'Auto-schedule duration mismatch: Calculated % minutes, specified % minutes',
          EXTRACT(EPOCH FROM (NEW.auto_scheduled_end_at - NEW.auto_scheduled_start_at)) / 60,
          NEW.auto_scheduled_duration_minutes;
      END IF;
    END IF;
  END IF;
  
  -- Validate manual scheduled times
  IF NEW.scheduled_start_at IS NOT NULL AND NEW.scheduled_end_at IS NOT NULL THEN
    IF NEW.scheduled_end_at <= NEW.scheduled_start_at THEN
      RAISE EXCEPTION 'Invalid manual schedule: End time must be after start time';
    END IF;
  END IF;
  
  -- Validate that scheduled times are not in the past (with 1 hour tolerance)
  IF NEW.auto_scheduled_start_at IS NOT NULL AND NEW.auto_scheduled_start_at < (now() - interval '1 hour') THEN
    RAISE EXCEPTION 'Cannot schedule job in the past: %', NEW.auto_scheduled_start_at;
  END IF;
  
  -- Validate working hours (8 AM to 5:30 PM SAST)
  IF NEW.auto_scheduled_start_at IS NOT NULL THEN
    IF EXTRACT(HOUR FROM NEW.auto_scheduled_start_at) < 8 OR EXTRACT(HOUR FROM NEW.auto_scheduled_start_at) >= 17.5 THEN
      RAISE EXCEPTION 'Scheduled start time % is outside working hours (8 AM - 5:30 PM)', NEW.auto_scheduled_start_at;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply schedule logic validation trigger
DROP TRIGGER IF EXISTS validate_scheduling_logic ON public.job_stage_instances;
CREATE TRIGGER validate_scheduling_logic
  BEFORE INSERT OR UPDATE ON public.job_stage_instances
  FOR EACH ROW EXECUTE FUNCTION public.validate_schedule_logic();

-- **INTEGRITY CONSTRAINT 5: Concurrent access protection**
-- Prevent race conditions in stage transitions
CREATE OR REPLACE FUNCTION public.prevent_concurrent_stage_changes()
RETURNS TRIGGER AS $$
DECLARE
  current_status TEXT;
BEGIN
  -- Re-check current status to prevent race conditions
  SELECT status INTO current_status
  FROM public.job_stage_instances
  WHERE id = NEW.id
  FOR UPDATE; -- Lock the row
  
  -- Validate status transition
  IF OLD.status = 'completed' AND NEW.status != 'completed' THEN
    RAISE EXCEPTION 'Cannot change status of completed stage instance %', NEW.id;
  END IF;
  
  IF OLD.status = 'active' AND NEW.status = 'pending' THEN
    -- Only allow if explicitly reworking
    IF NEW.is_rework IS NOT TRUE THEN
      RAISE EXCEPTION 'Cannot revert active stage to pending without rework flag';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply concurrent access protection trigger
DROP TRIGGER IF EXISTS prevent_race_conditions ON public.job_stage_instances;
CREATE TRIGGER prevent_race_conditions
  BEFORE UPDATE ON public.job_stage_instances
  FOR EACH ROW EXECUTE FUNCTION public.prevent_concurrent_stage_changes();

-- **DATA INTEGRITY VIEW: Scheduling Health Monitor**
CREATE OR REPLACE VIEW public.scheduling_integrity_monitor AS
SELECT 
  'Stage Capacity Violations' as check_type,
  COUNT(*) as violation_count,
  json_agg(
    json_build_object(
      'stage_id', production_stage_id,
      'date', schedule_date,
      'used_minutes', used_minutes,
      'capacity_minutes', capacity_minutes
    )
  ) as violations
FROM (
  SELECT 
    jsi.production_stage_id,
    COALESCE(jsi.auto_scheduled_start_at::date, jsi.scheduled_start_at::date) as schedule_date,
    SUM(COALESCE(jsi.auto_scheduled_duration_minutes, jsi.scheduled_minutes, 60)) as used_minutes,
    COALESCE(scp.daily_capacity_hours * 60, 480) as capacity_minutes
  FROM public.job_stage_instances jsi
  LEFT JOIN public.stage_capacity_profiles scp ON jsi.production_stage_id = scp.production_stage_id
  WHERE jsi.status IN ('pending', 'active')
    AND (jsi.auto_scheduled_start_at IS NOT NULL OR jsi.scheduled_start_at IS NOT NULL)
    AND COALESCE(jsi.auto_scheduled_start_at::date, jsi.scheduled_start_at::date) >= CURRENT_DATE
  GROUP BY jsi.production_stage_id, schedule_date, scp.daily_capacity_hours
  HAVING SUM(COALESCE(jsi.auto_scheduled_duration_minutes, jsi.scheduled_minutes, 60)) > COALESCE(scp.daily_capacity_hours * 60, 480)
) capacity_violations

UNION ALL

SELECT 
  'Scheduling Conflicts' as check_type,
  COUNT(*) as violation_count,
  json_agg(
    json_build_object(
      'stage_id', production_stage_id,
      'job_ids', job_ids,
      'conflict_time', conflict_time
    )
  ) as violations
FROM (
  SELECT 
    jsi1.production_stage_id,
    array_agg(DISTINCT jsi1.job_id) as job_ids,
    jsi1.auto_scheduled_start_at as conflict_time
  FROM public.job_stage_instances jsi1
  JOIN public.job_stage_instances jsi2 ON (
    jsi1.production_stage_id = jsi2.production_stage_id
    AND jsi1.id != jsi2.id
    AND jsi1.auto_scheduled_start_at < jsi2.auto_scheduled_end_at
    AND jsi1.auto_scheduled_end_at > jsi2.auto_scheduled_start_at
  )
  WHERE jsi1.status IN ('pending', 'active')
    AND jsi2.status IN ('pending', 'active')
    AND jsi1.auto_scheduled_start_at IS NOT NULL
    AND jsi2.auto_scheduled_start_at IS NOT NULL
  GROUP BY jsi1.production_stage_id, jsi1.auto_scheduled_start_at
) scheduling_conflicts;

-- **GRANT PERMISSIONS**
GRANT SELECT ON public.scheduling_integrity_monitor TO authenticated;

-- **CREATE LOGGING TABLE for integrity violations**
CREATE TABLE IF NOT EXISTS public.scheduling_integrity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  violation_type text NOT NULL,
  job_id uuid,
  stage_id uuid,
  violation_details jsonb DEFAULT '{}',
  detected_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  severity text NOT NULL DEFAULT 'warning' -- 'info', 'warning', 'error', 'critical'
);

-- Enable RLS on integrity logs
ALTER TABLE public.scheduling_integrity_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view integrity logs
CREATE POLICY "Users can view scheduling integrity logs" ON public.scheduling_integrity_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Allow system to insert integrity logs
CREATE POLICY "System can insert scheduling integrity logs" ON public.scheduling_integrity_logs
  FOR INSERT WITH CHECK (true);

-- **INTEGRITY CHECK FUNCTION**
CREATE OR REPLACE FUNCTION public.run_scheduling_integrity_check()
RETURNS TABLE(
  check_type text,
  status text,
  violation_count integer,
  details jsonb
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sim.check_type,
    CASE 
      WHEN sim.violation_count = 0 THEN 'PASS'
      WHEN sim.violation_count <= 5 THEN 'WARNING'
      ELSE 'CRITICAL'
    END as status,
    sim.violation_count,
    sim.violations as details
  FROM public.scheduling_integrity_monitor sim;
END;
$$;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION public.run_scheduling_integrity_check() TO authenticated;