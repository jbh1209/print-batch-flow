-- Create triggers to automatically recalculate due dates when production changes occur

-- Function to trigger due date recalculation for affected jobs
CREATE OR REPLACE FUNCTION public.trigger_due_date_recalculation()
RETURNS TRIGGER AS $$
BEGIN
  -- This function will be called by our application logic
  -- We store a flag to indicate recalculation is needed
  INSERT INTO public.due_date_recalculation_queue (
    job_id, 
    job_table_name, 
    trigger_reason, 
    created_at
  ) 
  VALUES (
    COALESCE(NEW.job_id, OLD.job_id),
    COALESCE(NEW.job_table_name, OLD.job_table_name, 'production_jobs'),
    TG_OP || '_' || TG_TABLE_NAME,
    now()
  )
  ON CONFLICT (job_id, job_table_name) 
  DO UPDATE SET 
    trigger_reason = EXCLUDED.trigger_reason,
    created_at = EXCLUDED.created_at;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create queue table for due date recalculations
CREATE TABLE IF NOT EXISTS public.due_date_recalculation_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  job_table_name TEXT NOT NULL DEFAULT 'production_jobs',
  trigger_reason TEXT NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(job_id, job_table_name)
);

-- Enable RLS on the queue table
ALTER TABLE public.due_date_recalculation_queue ENABLE ROW LEVEL SECURITY;

-- Allow system to manage the queue
CREATE POLICY "Allow system to manage due date recalculation queue" 
ON public.due_date_recalculation_queue 
FOR ALL 
USING (true);

-- Trigger when job stage instances are updated (stage completion, expediting, etc.)
CREATE OR REPLACE TRIGGER trigger_due_date_recalc_on_stage_update
  AFTER UPDATE ON public.job_stage_instances
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.job_order_in_stage IS DISTINCT FROM NEW.job_order_in_stage)
  EXECUTE FUNCTION public.trigger_due_date_recalculation();

-- Trigger when production jobs are expedited
CREATE OR REPLACE TRIGGER trigger_due_date_recalc_on_job_expedite
  AFTER UPDATE ON public.production_jobs
  FOR EACH ROW
  WHEN (OLD.is_expedited IS DISTINCT FROM NEW.is_expedited)
  EXECUTE FUNCTION public.trigger_due_date_recalculation();

-- Function to process due date recalculation queue
CREATE OR REPLACE FUNCTION public.process_due_date_recalculation_queue()
RETURNS INTEGER AS $$
DECLARE
  queue_item RECORD;
  processed_count INTEGER := 0;
BEGIN
  -- Process unprocessed queue items
  FOR queue_item IN
    SELECT id, job_id, job_table_name
    FROM public.due_date_recalculation_queue
    WHERE processed = false
      AND created_at > now() - interval '1 hour' -- Only process recent items
    ORDER BY created_at
    LIMIT 100 -- Process in batches
  LOOP
    -- Mark as processed
    UPDATE public.due_date_recalculation_queue
    SET 
      processed = true,
      processed_at = now()
    WHERE id = queue_item.id;
    
    processed_count := processed_count + 1;
  END LOOP;
  
  -- Clean up old processed items (older than 24 hours)
  DELETE FROM public.due_date_recalculation_queue
  WHERE processed = true 
    AND processed_at < now() - interval '24 hours';
  
  RETURN processed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;