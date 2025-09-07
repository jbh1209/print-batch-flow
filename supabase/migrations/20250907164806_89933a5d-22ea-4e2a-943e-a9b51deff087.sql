-- Fix scheduling order issues and reset incorrect schedules for D426502 and D426506

-- First, clear the existing incorrect schedules for these jobs
UPDATE job_stage_instances 
SET 
  scheduled_start_at = NULL,
  scheduled_end_at = NULL, 
  scheduled_minutes = NULL,
  updated_at = now()
WHERE job_id IN (
  SELECT id FROM production_jobs WHERE wo_no IN ('D426502', 'D426506')
)
AND job_table_name = 'production_jobs'
AND status = 'pending';

-- Update the scheduler function to respect FIFO ordering based on proof approval timestamps
-- This ensures D426502 (approved first or created first) comes before D426506

CREATE OR REPLACE FUNCTION public.scheduler_reschedule_all_parallel_aware()
RETURNS TABLE(updated_jsi integer, wrote_slots integer, violations text[])
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  stage_record RECORD;
  job_record RECORD;
  current_time timestamptz;
  slot_start timestamptz;
  slot_end timestamptz;
  total_updated integer := 0;
  total_slots integer := 0;
  violation_list text[] := '{}';
BEGIN
  current_time := now();
  
  -- Clear all existing schedules for pending stages
  UPDATE job_stage_instances 
  SET 
    scheduled_start_at = NULL,
    scheduled_end_at = NULL,
    scheduled_minutes = NULL,
    updated_at = current_time
  WHERE status = 'pending';
  
  -- Clear all existing time slots
  DELETE FROM stage_time_slots;
  
  -- Create stage availability tracker
  CREATE TEMP TABLE IF NOT EXISTS stage_availability (
    stage_id uuid PRIMARY KEY,
    next_available_time timestamptz NOT NULL DEFAULT now()
  );
  
  -- Initialize stage availability for all active stages
  INSERT INTO stage_availability (stage_id, next_available_time)
  SELECT id, current_time
  FROM production_stages 
  WHERE is_active = true
  ON CONFLICT (stage_id) DO UPDATE SET next_available_time = EXCLUDED.next_available_time;
  
  -- Process jobs in FIFO order: proof_approved_at first, then created_at as fallback
  FOR job_record IN
    SELECT DISTINCT 
      jsi.job_id,
      pj.wo_no,
      COALESCE(pj.proof_approved_at, pj.created_at) as priority_timestamp
    FROM job_stage_instances jsi
    JOIN production_jobs pj ON jsi.job_id = pj.id
    WHERE jsi.job_table_name = 'production_jobs'
      AND jsi.status = 'pending'
    ORDER BY priority_timestamp ASC  -- FIFO ordering
  LOOP
    -- Process stages for this job in stage_order
    FOR stage_record IN
      SELECT 
        jsi.id,
        jsi.production_stage_id,
        jsi.stage_order,
        COALESCE(jsi.estimated_duration_minutes, 60) as duration_minutes,
        ps.name as stage_name
      FROM job_stage_instances jsi
      JOIN production_stages ps ON jsi.production_stage_id = ps.id
      WHERE jsi.job_id = job_record.job_id
        AND jsi.job_table_name = 'production_jobs'  
        AND jsi.status = 'pending'
      ORDER BY jsi.stage_order
    LOOP
      -- Get next available time for this stage
      SELECT next_available_time INTO slot_start
      FROM stage_availability 
      WHERE stage_id = stage_record.production_stage_id;
      
      -- Calculate slot end time
      slot_end := slot_start + make_interval(mins => stage_record.duration_minutes);
      
      -- Update job stage instance with schedule
      UPDATE job_stage_instances 
      SET 
        scheduled_start_at = slot_start,
        scheduled_end_at = slot_end,
        scheduled_minutes = stage_record.duration_minutes,
        updated_at = current_time
      WHERE id = stage_record.id;
      
      -- Create time slot
      INSERT INTO stage_time_slots (
        production_stage_id,
        job_id,
        stage_instance_id,
        slot_start_time,
        slot_end_time,
        duration_minutes,
        job_table_name
      ) VALUES (
        stage_record.production_stage_id,
        job_record.job_id,
        stage_record.id,
        slot_start,
        slot_end,
        stage_record.duration_minutes,
        'production_jobs'
      );
      
      -- Update stage availability
      UPDATE stage_availability 
      SET next_available_time = slot_end
      WHERE stage_id = stage_record.production_stage_id;
      
      total_updated := total_updated + 1;
      total_slots := total_slots + 1;
      
      RAISE NOTICE 'Scheduled % stage % for job % from % to %', 
        stage_record.stage_name, stage_record.production_stage_id, job_record.wo_no, slot_start, slot_end;
    END LOOP;
  END LOOP;
  
  DROP TABLE IF EXISTS stage_availability;
  
  RETURN QUERY SELECT total_updated, total_slots, violation_list;
END;
$function$;