-- PHASE 4: DEBUGGING & MONITORING LAYER
-- Comprehensive logging, decision tracking, and real-time monitoring

-- **SCHEDULING DECISION LOGS TABLE**
-- Captures detailed information about every scheduling decision
CREATE TABLE IF NOT EXISTS public.scheduling_decision_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  job_table_name text NOT NULL DEFAULT 'production_jobs',
  stage_id uuid NOT NULL,
  decision_type text NOT NULL, -- 'capacity_check', 'slot_assignment', 'conflict_resolution', 'capacity_overflow'
  decision_timestamp timestamp with time zone NOT NULL DEFAULT now(),
  requested_start_time timestamp with time zone,
  assigned_start_time timestamp with time zone,
  assigned_end_time timestamp with time zone,
  duration_minutes integer,
  decision_factors jsonb DEFAULT '{}', -- Detailed factors that influenced the decision
  stage_capacity_info jsonb DEFAULT '{}', -- Capacity details at time of decision
  alternative_slots jsonb DEFAULT '[]', -- Other slots that were considered
  decision_reasoning text, -- Human-readable explanation
  scheduler_version text DEFAULT 'v3.0-capacity-aware',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on decision logs
ALTER TABLE public.scheduling_decision_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view decision logs
CREATE POLICY "Users can view scheduling decision logs" ON public.scheduling_decision_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Allow system to insert decision logs
CREATE POLICY "System can insert scheduling decision logs" ON public.scheduling_decision_logs
  FOR INSERT WITH CHECK (true);

-- **CAPACITY UTILIZATION TRACKING**
-- Real-time tracking of stage capacity utilization
CREATE TABLE IF NOT EXISTS public.stage_capacity_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL,
  snapshot_date date NOT NULL,
  snapshot_timestamp timestamp with time zone NOT NULL DEFAULT now(),
  total_capacity_minutes integer NOT NULL,
  used_capacity_minutes integer NOT NULL DEFAULT 0,
  available_capacity_minutes integer NOT NULL DEFAULT 0,
  utilization_percentage numeric(5,2) NOT NULL DEFAULT 0.0,
  active_jobs_count integer NOT NULL DEFAULT 0,
  pending_jobs_count integer NOT NULL DEFAULT 0,
  scheduled_jobs jsonb DEFAULT '[]', -- Details of jobs scheduled for this date
  capacity_warnings jsonb DEFAULT '[]', -- Any capacity warnings or alerts
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  UNIQUE(stage_id, snapshot_date)
);

-- Enable RLS on capacity snapshots
ALTER TABLE public.stage_capacity_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view capacity snapshots
CREATE POLICY "Users can view stage capacity snapshots" ON public.stage_capacity_snapshots
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Allow system to manage capacity snapshots
CREATE POLICY "System can manage stage capacity snapshots" ON public.stage_capacity_snapshots
  FOR ALL USING (true);

-- **ENHANCED SCHEDULING FUNCTION WITH DECISION LOGGING**
CREATE OR REPLACE FUNCTION public.schedule_job_with_detailed_logging(
  p_job_id uuid,
  p_job_table_name text,
  p_stage_id uuid,
  p_estimated_minutes integer,
  p_earliest_start timestamp with time zone DEFAULT NULL
) RETURNS TABLE(
  scheduled_start timestamp with time zone,
  scheduled_end timestamp with time zone,
  decision_log_id uuid,
  reasoning text,
  capacity_info jsonb
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  stage_capacity_minutes INTEGER;
  used_capacity_minutes INTEGER;
  available_minutes INTEGER;
  schedule_date DATE;
  slot_start TIMESTAMP WITH TIME ZONE;
  slot_end TIMESTAMP WITH TIME ZONE;
  decision_factors JSONB;
  stage_info JSONB;
  log_id UUID;
  reasoning_text TEXT;
  working_start_hour INTEGER := 8;
  working_end_hour NUMERIC := 17.5;
BEGIN
  -- Default earliest start to now if not provided
  p_earliest_start := COALESCE(p_earliest_start, now());
  
  -- Start with the earliest possible date
  schedule_date := p_earliest_start::date;
  
  -- Skip weekends
  WHILE EXTRACT(DOW FROM schedule_date) IN (0, 6) LOOP
    schedule_date := schedule_date + interval '1 day';
  END LOOP;
  
  -- Get stage capacity profile
  SELECT 
    COALESCE(scp.daily_capacity_hours * 60, 480)
  INTO stage_capacity_minutes
  FROM public.stage_capacity_profiles scp
  WHERE scp.production_stage_id = p_stage_id;
  
  -- Default to 8 hours if no capacity profile
  stage_capacity_minutes := COALESCE(stage_capacity_minutes, 480);
  
  -- Find the first available slot within the next 30 days
  FOR day_offset IN 0..30 LOOP
    schedule_date := (p_earliest_start::date) + (day_offset || ' days')::interval;
    
    -- Skip weekends
    IF EXTRACT(DOW FROM schedule_date) IN (0, 6) THEN
      CONTINUE;
    END IF;
    
    -- Calculate used capacity for this date
    SELECT COALESCE(SUM(
      COALESCE(jsi.auto_scheduled_duration_minutes, jsi.scheduled_minutes, jsi.estimated_duration_minutes, 60)
    ), 0) INTO used_capacity_minutes
    FROM public.job_stage_instances jsi
    WHERE jsi.production_stage_id = p_stage_id
      AND jsi.status IN ('pending', 'active', 'completed')
      AND (
        jsi.auto_scheduled_start_at::date = schedule_date OR
        jsi.scheduled_start_at::date = schedule_date
      );
    
    available_minutes := stage_capacity_minutes - used_capacity_minutes;
    
    -- Check if there's enough capacity
    IF available_minutes >= p_estimated_minutes THEN
      -- Calculate start time: beginning of work day + used time
      slot_start := schedule_date + (working_start_hour || ' hours')::interval + (used_capacity_minutes || ' minutes')::interval;
      slot_end := slot_start + (p_estimated_minutes || ' minutes')::interval;
      
      -- Check if slot fits within working hours
      IF EXTRACT(EPOCH FROM slot_end::time) / 3600 <= working_end_hour THEN
        -- Found a valid slot!
        
        -- Prepare decision factors
        decision_factors := jsonb_build_object(
          'days_from_earliest', day_offset,
          'stage_capacity_minutes', stage_capacity_minutes,
          'used_capacity_minutes', used_capacity_minutes,
          'available_capacity_minutes', available_minutes,
          'job_duration_minutes', p_estimated_minutes,
          'working_start_hour', working_start_hour,
          'working_end_hour', working_end_hour,
          'schedule_date', schedule_date,
          'capacity_utilization_percent', ROUND((used_capacity_minutes + p_estimated_minutes)::numeric / stage_capacity_minutes * 100, 2)
        );
        
        -- Prepare stage info
        stage_info := jsonb_build_object(
          'stage_id', p_stage_id,
          'total_capacity_minutes', stage_capacity_minutes,
          'capacity_before_job', used_capacity_minutes,
          'capacity_after_job', used_capacity_minutes + p_estimated_minutes,
          'utilization_before_percent', ROUND(used_capacity_minutes::numeric / stage_capacity_minutes * 100, 2),
          'utilization_after_percent', ROUND((used_capacity_minutes + p_estimated_minutes)::numeric / stage_capacity_minutes * 100, 2)
        );
        
        -- Create reasoning text
        IF day_offset = 0 THEN
          reasoning_text := format(
            'Scheduled for today (%s) at %s. Stage has %s minutes available out of %s total capacity (%s%% utilization after this job).',
            schedule_date,
            slot_start::time,
            available_minutes,
            stage_capacity_minutes,
            ROUND((used_capacity_minutes + p_estimated_minutes)::numeric / stage_capacity_minutes * 100, 2)
          );
        ELSE
          reasoning_text := format(
            'Scheduled %s days from requested date (%s) at %s. Previous days were at capacity. Stage will be %s%% utilized after this job.',
            day_offset,
            schedule_date,
            slot_start::time,
            ROUND((used_capacity_minutes + p_estimated_minutes)::numeric / stage_capacity_minutes * 100, 2)
          );
        END IF;
        
        -- Log the decision
        INSERT INTO public.scheduling_decision_logs (
          job_id,
          job_table_name,
          stage_id,
          decision_type,
          requested_start_time,
          assigned_start_time,
          assigned_end_time,
          duration_minutes,
          decision_factors,
          stage_capacity_info,
          decision_reasoning
        ) VALUES (
          p_job_id,
          p_job_table_name,
          p_stage_id,
          'slot_assignment',
          p_earliest_start,
          slot_start,
          slot_end,
          p_estimated_minutes,
          decision_factors,
          stage_info,
          reasoning_text
        ) RETURNING id INTO log_id;
        
        -- Update capacity snapshot
        INSERT INTO public.stage_capacity_snapshots (
          stage_id,
          snapshot_date,
          total_capacity_minutes,
          used_capacity_minutes,
          available_capacity_minutes,
          utilization_percentage,
          scheduled_jobs
        ) VALUES (
          p_stage_id,
          schedule_date,
          stage_capacity_minutes,
          used_capacity_minutes + p_estimated_minutes,
          stage_capacity_minutes - (used_capacity_minutes + p_estimated_minutes),
          ROUND((used_capacity_minutes + p_estimated_minutes)::numeric / stage_capacity_minutes * 100, 2),
          jsonb_build_array(jsonb_build_object(
            'job_id', p_job_id,
            'start_time', slot_start,
            'end_time', slot_end,
            'duration_minutes', p_estimated_minutes
          ))
        ) ON CONFLICT (stage_id, snapshot_date) DO UPDATE SET
          used_capacity_minutes = public.stage_capacity_snapshots.used_capacity_minutes + p_estimated_minutes,
          available_capacity_minutes = public.stage_capacity_snapshots.available_capacity_minutes - p_estimated_minutes,
          utilization_percentage = ROUND((public.stage_capacity_snapshots.used_capacity_minutes + p_estimated_minutes)::numeric / public.stage_capacity_snapshots.total_capacity_minutes * 100, 2),
          scheduled_jobs = public.stage_capacity_snapshots.scheduled_jobs || jsonb_build_array(jsonb_build_object(
            'job_id', p_job_id,
            'start_time', slot_start,
            'end_time', slot_end,
            'duration_minutes', p_estimated_minutes
          )),
          snapshot_timestamp = now();
        
        -- Return the result
        RETURN QUERY SELECT slot_start, slot_end, log_id, reasoning_text, stage_info;
        RETURN;
      END IF;
    END IF;
    
    -- Log capacity overflow for this date
    INSERT INTO public.scheduling_decision_logs (
      job_id,
      job_table_name,
      stage_id,
      decision_type,
      requested_start_time,
      duration_minutes,
      decision_factors,
      decision_reasoning
    ) VALUES (
      p_job_id,
      p_job_table_name,
      p_stage_id,
      'capacity_overflow',
      p_earliest_start,
      p_estimated_minutes,
      jsonb_build_object(
        'check_date', schedule_date,
        'stage_capacity_minutes', stage_capacity_minutes,
        'used_capacity_minutes', used_capacity_minutes,
        'available_capacity_minutes', available_minutes,
        'required_minutes', p_estimated_minutes,
        'overflow_minutes', p_estimated_minutes - available_minutes
      ),
      format(
        'Date %s rejected: Only %s minutes available, need %s minutes (overflow: %s minutes)',
        schedule_date,
        available_minutes,
        p_estimated_minutes,
        p_estimated_minutes - available_minutes
      )
    );
  END LOOP;
  
  -- If we get here, no slot was found in 30 days
  INSERT INTO public.scheduling_decision_logs (
    job_id,
    job_table_name,
    stage_id,
    decision_type,
    requested_start_time,
    duration_minutes,
    decision_reasoning
  ) VALUES (
    p_job_id,
    p_job_table_name,
    p_stage_id,
    'no_capacity_found',
    p_earliest_start,
    p_estimated_minutes,
    'No available capacity found within 30-day scheduling window'
  );
  
  -- Return null result
  RETURN QUERY SELECT NULL::timestamp with time zone, NULL::timestamp with time zone, NULL::uuid, 'No capacity available'::text, '{}'::jsonb;
END;
$$;

-- **REAL-TIME CAPACITY MONITORING VIEW**
CREATE OR REPLACE VIEW public.real_time_capacity_monitor AS
SELECT 
  ps.id as stage_id,
  ps.name as stage_name,
  ps.color as stage_color,
  COALESCE(scp.daily_capacity_hours * 60, 480) as total_capacity_minutes,
  COALESCE(current_usage.used_minutes, 0) as used_minutes_today,
  COALESCE(scp.daily_capacity_hours * 60, 480) - COALESCE(current_usage.used_minutes, 0) as available_minutes_today,
  CASE 
    WHEN COALESCE(scp.daily_capacity_hours * 60, 480) > 0 THEN
      ROUND(COALESCE(current_usage.used_minutes, 0)::numeric / (scp.daily_capacity_hours * 60) * 100, 2)
    ELSE 0
  END as utilization_percentage,
  COALESCE(current_usage.active_jobs, 0) as active_jobs_count,
  COALESCE(current_usage.pending_jobs, 0) as pending_jobs_count,
  CASE 
    WHEN COALESCE(current_usage.used_minutes, 0)::numeric / COALESCE(scp.daily_capacity_hours * 60, 480) > 0.9 THEN 'critical'
    WHEN COALESCE(current_usage.used_minutes, 0)::numeric / COALESCE(scp.daily_capacity_hours * 60, 480) > 0.7 THEN 'warning'
    ELSE 'healthy'
  END as capacity_status,
  now() as last_updated
FROM public.production_stages ps
LEFT JOIN public.stage_capacity_profiles scp ON ps.id = scp.production_stage_id
LEFT JOIN (
  SELECT 
    jsi.production_stage_id,
    SUM(COALESCE(jsi.auto_scheduled_duration_minutes, jsi.scheduled_minutes, jsi.estimated_duration_minutes, 60)) as used_minutes,
    COUNT(CASE WHEN jsi.status = 'active' THEN 1 END) as active_jobs,
    COUNT(CASE WHEN jsi.status = 'pending' THEN 1 END) as pending_jobs
  FROM public.job_stage_instances jsi
  WHERE (
    jsi.auto_scheduled_start_at::date = CURRENT_DATE OR
    jsi.scheduled_start_at::date = CURRENT_DATE OR
    (jsi.auto_scheduled_start_at IS NULL AND jsi.scheduled_start_at IS NULL AND jsi.status = 'active')
  )
  AND jsi.status IN ('pending', 'active', 'completed')
  GROUP BY jsi.production_stage_id
) current_usage ON ps.id = current_usage.production_stage_id
WHERE ps.is_active = true
ORDER BY utilization_percentage DESC;

-- Grant permissions on monitoring view
GRANT SELECT ON public.real_time_capacity_monitor TO authenticated;

-- **SCHEDULING DECISION EXPLANATION FUNCTION**
CREATE OR REPLACE FUNCTION public.explain_job_scheduling(
  p_job_id uuid,
  p_job_table_name text DEFAULT 'production_jobs'
) RETURNS TABLE(
  stage_name text,
  scheduled_time text,
  explanation text,
  decision_factors jsonb,
  alternative_options text[]
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ps.name as stage_name,
    COALESCE(
      jsi.auto_scheduled_start_at::text,
      jsi.scheduled_start_at::text,
      'Not scheduled'
    ) as scheduled_time,
    COALESCE(sdl.decision_reasoning, 'No scheduling decision recorded') as explanation,
    COALESCE(sdl.decision_factors, '{}'::jsonb) as decision_factors,
    CASE 
      WHEN sdl.alternative_slots IS NOT NULL AND jsonb_array_length(sdl.alternative_slots) > 0 THEN
        ARRAY(SELECT jsonb_array_elements_text(sdl.alternative_slots))
      ELSE
        ARRAY[]::text[]
    END as alternative_options
  FROM public.job_stage_instances jsi
  JOIN public.production_stages ps ON jsi.production_stage_id = ps.id
  LEFT JOIN public.scheduling_decision_logs sdl ON (
    sdl.job_id = jsi.job_id 
    AND sdl.stage_id = jsi.production_stage_id
    AND sdl.decision_type = 'slot_assignment'
  )
  WHERE jsi.job_id = p_job_id 
    AND jsi.job_table_name = p_job_table_name
  ORDER BY jsi.stage_order;
END;
$$;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION public.explain_job_scheduling(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_job_with_detailed_logging(uuid, text, uuid, integer, timestamp with time zone) TO authenticated;