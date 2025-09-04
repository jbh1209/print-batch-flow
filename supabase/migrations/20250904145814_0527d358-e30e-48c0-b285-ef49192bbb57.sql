-- Problem #4: Queue State Management - Create persistent queue tracking tables

-- Create production_stage_queues table to replace temporary _stage_tails
CREATE TABLE IF NOT EXISTS public.production_stage_queues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_stage_id UUID NOT NULL,
  next_available_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_scheduled_minutes INTEGER NOT NULL DEFAULT 0,
  active_jobs_count INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure one queue per stage
  CONSTRAINT unique_stage_queue UNIQUE (production_stage_id)
);

-- Create stage_queue_positions table for detailed queue tracking
CREATE TABLE IF NOT EXISTS public.stage_queue_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_stage_id UUID NOT NULL,
  stage_instance_id UUID NOT NULL,
  job_id UUID NOT NULL,
  job_table_name TEXT NOT NULL DEFAULT 'production_jobs',
  queue_position INTEGER NOT NULL,
  estimated_start_time TIMESTAMPTZ,
  estimated_end_time TIMESTAMPTZ,
  duration_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- queued, active, completed, cancelled
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure unique positions per stage
  CONSTRAINT unique_stage_position UNIQUE (production_stage_id, queue_position),
  -- Ensure unique stage instance
  CONSTRAINT unique_stage_instance UNIQUE (stage_instance_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stage_queues_stage_id ON production_stage_queues(production_stage_id);
CREATE INDEX IF NOT EXISTS idx_stage_queues_next_available ON production_stage_queues(next_available_time);
CREATE INDEX IF NOT EXISTS idx_queue_positions_stage_id ON stage_queue_positions(production_stage_id);
CREATE INDEX IF NOT EXISTS idx_queue_positions_job_id ON stage_queue_positions(job_id);
CREATE INDEX IF NOT EXISTS idx_queue_positions_status ON stage_queue_positions(status);
CREATE INDEX IF NOT EXISTS idx_queue_positions_position ON stage_queue_positions(production_stage_id, queue_position);

-- Enable RLS
ALTER TABLE public.production_stage_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_queue_positions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow authenticated users to view stage queues" 
ON public.production_stage_queues 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow system to manage stage queues" 
ON public.production_stage_queues 
FOR ALL 
USING (true);

CREATE POLICY "Allow authenticated users to view queue positions" 
ON public.stage_queue_positions 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow system to manage queue positions" 
ON public.stage_queue_positions 
FOR ALL 
USING (true);

-- Function to initialize or refresh queue state from existing data
CREATE OR REPLACE FUNCTION public.initialize_queue_state()
RETURNS INTEGER
LANGUAGE plpgsql
AS $function$
DECLARE
  queue_count INTEGER := 0;
BEGIN
  -- Clear existing queue state
  DELETE FROM stage_queue_positions;
  DELETE FROM production_stage_queues;
  
  -- Initialize queues for all production stages with current availability
  INSERT INTO production_stage_queues (production_stage_id, next_available_time, total_scheduled_minutes, active_jobs_count)
  SELECT 
    ps.id,
    GREATEST(
      COALESCE(MAX(sts.slot_end_time), now()),
      now()
    ) as next_available_time,
    COALESCE(SUM(
      CASE 
        WHEN sts.is_completed = false THEN sts.duration_minutes 
        ELSE 0 
      END
    ), 0) as total_scheduled_minutes,
    COUNT(DISTINCT CASE WHEN sts.is_completed = false THEN sts.job_id END) as active_jobs_count
  FROM production_stages ps
  LEFT JOIN stage_time_slots sts ON sts.production_stage_id = ps.id
  GROUP BY ps.id
  ON CONFLICT (production_stage_id) DO UPDATE SET
    next_available_time = EXCLUDED.next_available_time,
    total_scheduled_minutes = EXCLUDED.total_scheduled_minutes,
    active_jobs_count = EXCLUDED.active_jobs_count,
    last_updated = now();
  
  GET DIAGNOSTICS queue_count = ROW_COUNT;
  
  -- Initialize queue positions for scheduled but not completed stages
  INSERT INTO stage_queue_positions (
    production_stage_id, stage_instance_id, job_id, job_table_name,
    queue_position, estimated_start_time, estimated_end_time, 
    duration_minutes, status
  )
  SELECT 
    jsi.production_stage_id,
    jsi.id,
    jsi.job_id,
    jsi.job_table_name,
    ROW_NUMBER() OVER (
      PARTITION BY jsi.production_stage_id 
      ORDER BY COALESCE(jsi.scheduled_start_at, jsi.created_at)
    ) as queue_position,
    jsi.scheduled_start_at,
    jsi.scheduled_end_at,
    COALESCE(jsi.scheduled_minutes, jsi.estimated_duration_minutes, 60),
    CASE 
      WHEN jsi.status = 'completed' THEN 'completed'
      WHEN jsi.status = 'active' THEN 'active'
      WHEN jsi.scheduled_start_at IS NOT NULL THEN 'queued'
      ELSE 'queued'
    END as status
  FROM job_stage_instances jsi
  WHERE jsi.status IN ('pending', 'scheduled', 'active', 'completed')
  ON CONFLICT (stage_instance_id) DO UPDATE SET
    queue_position = EXCLUDED.queue_position,
    estimated_start_time = EXCLUDED.estimated_start_time,
    estimated_end_time = EXCLUDED.estimated_end_time,
    status = EXCLUDED.status,
    updated_at = now();
  
  RETURN queue_count;
END;
$function$;

-- Function to get next available time for a stage (replaces _stage_tails lookup)
CREATE OR REPLACE FUNCTION public.get_stage_next_available_time(p_stage_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $function$
  SELECT COALESCE(psq.next_available_time, now())
  FROM production_stage_queues psq
  WHERE psq.production_stage_id = p_stage_id;
$function$;

-- Function to update stage availability after scheduling
CREATE OR REPLACE FUNCTION public.update_stage_availability(
  p_stage_id UUID, 
  p_new_available_time TIMESTAMPTZ,
  p_additional_minutes INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO production_stage_queues (production_stage_id, next_available_time, total_scheduled_minutes)
  VALUES (p_stage_id, p_new_available_time, p_additional_minutes)
  ON CONFLICT (production_stage_id) DO UPDATE SET
    next_available_time = GREATEST(EXCLUDED.next_available_time, production_stage_queues.next_available_time),
    total_scheduled_minutes = production_stage_queues.total_scheduled_minutes + EXCLUDED.total_scheduled_minutes,
    last_updated = now();
END;
$function$;

-- Initialize queue state with existing data
SELECT public.initialize_queue_state();