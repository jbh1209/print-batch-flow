-- Create trigger to automatically schedule jobs when approved
CREATE OR REPLACE FUNCTION trigger_simple_scheduler()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when status changes to something that indicates approval
  -- Common approval statuses: 'approved', 'ready', 'in production', etc.
  IF NEW.status IS DISTINCT FROM OLD.status AND 
     (NEW.status ILIKE '%approved%' OR 
      NEW.status ILIKE '%ready%' OR 
      NEW.status ILIKE '%production%' OR
      NEW.status = 'Pre-Press') THEN
    
    -- Call the simple scheduler edge function
    PERFORM net.http_post(
      url := 'https://kgizusgqexmlfcqfjopk.supabase.co/functions/v1/simple-scheduler',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnaXp1c2dxZXhtbGZjcWZqb3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ1NTQwNzAsImV4cCI6MjA2MDEzMDA3MH0.NA2wRme-L8Z15my7n8u-BCQtO4Nw2opfsX0KSLYcs-I"}'::jsonb,
      body := jsonb_build_object(
        'job_id', NEW.id,
        'job_table_name', 'production_jobs'
      )
    );
    
    RAISE NOTICE 'Triggered simple scheduler for job % with status %', NEW.id, NEW.status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS auto_schedule_approved_jobs ON production_jobs;
CREATE TRIGGER auto_schedule_approved_jobs
  AFTER UPDATE ON production_jobs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_simple_scheduler();