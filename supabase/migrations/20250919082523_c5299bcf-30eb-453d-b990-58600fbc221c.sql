-- Phase 4: Technical Infrastructure - Database Enhancements

-- Add computed columns for stage completeness scoring
ALTER TABLE job_stage_instances 
ADD COLUMN IF NOT EXISTS configuration_completeness_score INTEGER GENERATED ALWAYS AS (
  CASE 
    WHEN quantity IS NOT NULL AND estimated_duration_minutes IS NOT NULL AND part_assignment IS NOT NULL THEN 100
    WHEN (quantity IS NOT NULL)::INTEGER + (estimated_duration_minutes IS NOT NULL)::INTEGER + (part_assignment IS NOT NULL)::INTEGER >= 2 THEN 66
    WHEN (quantity IS NOT NULL)::INTEGER + (estimated_duration_minutes IS NOT NULL)::INTEGER + (part_assignment IS NOT NULL)::INTEGER >= 1 THEN 33
    ELSE 0
  END
) STORED;

-- Add workflow validation status column
ALTER TABLE production_jobs 
ADD COLUMN IF NOT EXISTS workflow_validation_status TEXT DEFAULT 'unvalidated' 
CHECK (workflow_validation_status IN ('valid', 'invalid', 'unvalidated', 'warning'));

-- Add workflow last modified timestamp
ALTER TABLE production_jobs 
ADD COLUMN IF NOT EXISTS workflow_last_modified_at TIMESTAMPTZ DEFAULT now();

-- Create index for performance on configuration queries
CREATE INDEX IF NOT EXISTS idx_job_stage_instances_config_completeness 
ON job_stage_instances (job_id, configuration_completeness_score, status);

CREATE INDEX IF NOT EXISTS idx_job_stage_instances_workflow_lookup 
ON job_stage_instances (job_id, job_table_name, stage_order, status);

CREATE INDEX IF NOT EXISTS idx_production_jobs_workflow_status 
ON production_jobs (has_custom_workflow, workflow_validation_status, proof_approved_at);

-- Add constraint to ensure stage order consistency
ALTER TABLE job_stage_instances 
ADD CONSTRAINT IF NOT EXISTS chk_stage_order_positive 
CHECK (stage_order > 0);

-- Add constraint to ensure duration and quantity are positive when set
ALTER TABLE job_stage_instances 
ADD CONSTRAINT IF NOT EXISTS chk_duration_positive 
CHECK (estimated_duration_minutes IS NULL OR estimated_duration_minutes > 0);

ALTER TABLE job_stage_instances 
ADD CONSTRAINT IF NOT EXISTS chk_quantity_positive 
CHECK (quantity IS NULL OR quantity > 0);

-- Create function to automatically populate quantity from job
CREATE OR REPLACE FUNCTION populate_stage_instance_defaults()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-populate quantity from job if not provided
  IF NEW.quantity IS NULL THEN
    CASE NEW.job_table_name
      WHEN 'production_jobs' THEN
        SELECT qty INTO NEW.quantity FROM production_jobs WHERE id = NEW.job_id;
      WHEN 'business_card_jobs' THEN
        SELECT quantity INTO NEW.quantity FROM business_card_jobs WHERE id = NEW.job_id;
      WHEN 'poster_jobs' THEN
        SELECT quantity INTO NEW.quantity FROM poster_jobs WHERE id = NEW.job_id;
      WHEN 'sleeve_jobs' THEN
        SELECT quantity INTO NEW.quantity FROM sleeve_jobs WHERE id = NEW.job_id;
      WHEN 'cover_jobs' THEN
        SELECT quantity INTO NEW.quantity FROM cover_jobs WHERE id = NEW.job_id;
      WHEN 'box_jobs' THEN
        SELECT quantity INTO NEW.quantity FROM box_jobs WHERE id = NEW.job_id;
    END CASE;
  END IF;

  -- Auto-populate estimated duration from stage specifications if available
  IF NEW.estimated_duration_minutes IS NULL AND NEW.stage_specification_id IS NOT NULL THEN
    DECLARE
      spec_record RECORD;
    BEGIN
      SELECT running_speed_per_hour, make_ready_time_minutes, speed_unit
      INTO spec_record
      FROM stage_specifications 
      WHERE id = NEW.stage_specification_id AND is_active = true;
      
      IF spec_record IS NOT NULL AND spec_record.running_speed_per_hour IS NOT NULL THEN
        -- Calculate duration based on speed and quantity
        CASE spec_record.speed_unit
          WHEN 'per_hour' THEN
            NEW.estimated_duration_minutes := COALESCE(spec_record.make_ready_time_minutes, 0) + 
              (COALESCE(NEW.quantity, 1) * 60.0 / spec_record.running_speed_per_hour);
          WHEN 'per_minute' THEN
            NEW.estimated_duration_minutes := COALESCE(spec_record.make_ready_time_minutes, 0) + 
              (COALESCE(NEW.quantity, 1) / spec_record.running_speed_per_hour);
          ELSE
            NEW.estimated_duration_minutes := COALESCE(spec_record.make_ready_time_minutes, 60);
        END CASE;
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic population
DROP TRIGGER IF EXISTS trigger_populate_stage_instance_defaults ON job_stage_instances;
CREATE TRIGGER trigger_populate_stage_instance_defaults
  BEFORE INSERT OR UPDATE ON job_stage_instances
  FOR EACH ROW
  EXECUTE FUNCTION populate_stage_instance_defaults();

-- Create function to update workflow validation status
CREATE OR REPLACE FUNCTION update_workflow_validation_status()
RETURNS TRIGGER AS $$
DECLARE
  job_record RECORD;
  validation_result TEXT;
  warning_count INTEGER;
  invalid_count INTEGER;
BEGIN
  -- Get job and stage statistics
  SELECT 
    pj.*,
    COUNT(jsi.id) as total_stages,
    COUNT(CASE WHEN jsi.configuration_completeness_score = 100 THEN 1 END) as complete_stages,
    COUNT(CASE WHEN jsi.configuration_completeness_score = 0 THEN 1 END) as empty_stages,
    COUNT(CASE WHEN jsi.quantity IS NULL THEN 1 END) as stages_without_quantity,
    COUNT(CASE WHEN jsi.estimated_duration_minutes IS NULL THEN 1 END) as stages_without_duration
  INTO job_record
  FROM production_jobs pj
  LEFT JOIN job_stage_instances jsi ON jsi.job_id = pj.id AND jsi.job_table_name = 'production_jobs'
  WHERE pj.id = COALESCE(NEW.job_id, OLD.job_id)
  GROUP BY pj.id, pj.wo_no, pj.has_custom_workflow, pj.manual_due_date, pj.manual_sla_days;

  -- Determine validation status
  IF job_record.has_custom_workflow = true THEN
    warning_count := COALESCE(job_record.stages_without_quantity, 0) + COALESCE(job_record.stages_without_duration, 0);
    invalid_count := COALESCE(job_record.empty_stages, 0);
    
    IF invalid_count > 0 THEN
      validation_result := 'invalid';
    ELSIF warning_count > 0 THEN
      validation_result := 'warning';  
    ELSIF job_record.total_stages > 0 THEN
      validation_result := 'valid';
    ELSE
      validation_result := 'unvalidated';
    END IF;
  ELSE
    validation_result := 'unvalidated';
  END IF;

  -- Update the job record
  UPDATE production_jobs 
  SET 
    workflow_validation_status = validation_result,
    workflow_last_modified_at = now()
  WHERE id = job_record.id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for workflow validation
DROP TRIGGER IF EXISTS trigger_update_workflow_validation ON job_stage_instances;
CREATE TRIGGER trigger_update_workflow_validation
  AFTER INSERT OR UPDATE OR DELETE ON job_stage_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_validation_status();

-- Create function for batch stage instance operations
CREATE OR REPLACE FUNCTION batch_update_stage_instances(
  p_job_id UUID,
  p_updates JSONB[]
)
RETURNS TABLE(updated_count INTEGER, errors TEXT[]) AS $$
DECLARE
  update_record JSONB;
  success_count INTEGER := 0;
  error_list TEXT[] := '{}';
  stage_id UUID;
BEGIN
  -- Process each update in the batch
  FOREACH update_record IN ARRAY p_updates
  LOOP
    BEGIN
      stage_id := (update_record->>'stage_id')::UUID;
      
      UPDATE job_stage_instances 
      SET 
        quantity = COALESCE((update_record->>'quantity')::INTEGER, quantity),
        estimated_duration_minutes = COALESCE((update_record->>'estimated_duration_minutes')::INTEGER, estimated_duration_minutes),
        part_assignment = COALESCE(update_record->>'part_assignment', part_assignment),
        stage_specification_id = COALESCE((update_record->>'stage_specification_id')::UUID, stage_specification_id),
        stage_order = COALESCE((update_record->>'stage_order')::INTEGER, stage_order),
        updated_at = now()
      WHERE production_stage_id = stage_id AND job_id = p_job_id;
      
      success_count := success_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      error_list := array_append(error_list, 'Stage ' || stage_id || ': ' || SQLERRM);
    END;
  END LOOP;
  
  updated_count := success_count;
  errors := error_list;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to calculate workflow metrics
CREATE OR REPLACE FUNCTION get_workflow_metrics(p_job_id UUID)
RETURNS TABLE(
  total_stages INTEGER,
  complete_stages INTEGER,
  partial_stages INTEGER,
  empty_stages INTEGER,
  total_quantity INTEGER,
  total_duration_minutes INTEGER,
  estimated_completion_days INTEGER,
  validation_status TEXT,
  configuration_warnings TEXT[]
) AS $$
DECLARE
  warning_list TEXT[] := '{}';
BEGIN
  -- Get basic metrics
  SELECT 
    COUNT(jsi.id)::INTEGER,
    COUNT(CASE WHEN jsi.configuration_completeness_score = 100 THEN 1 END)::INTEGER,
    COUNT(CASE WHEN jsi.configuration_completeness_score BETWEEN 1 AND 99 THEN 1 END)::INTEGER,
    COUNT(CASE WHEN jsi.configuration_completeness_score = 0 THEN 1 END)::INTEGER,
    COALESCE(SUM(jsi.quantity), 0)::INTEGER,
    COALESCE(SUM(jsi.estimated_duration_minutes), 0)::INTEGER,
    CEIL(COALESCE(SUM(jsi.estimated_duration_minutes), 0) / (8.0 * 60))::INTEGER
  INTO total_stages, complete_stages, partial_stages, empty_stages, total_quantity, total_duration_minutes, estimated_completion_days
  FROM job_stage_instances jsi
  WHERE jsi.job_id = p_job_id AND jsi.job_table_name = 'production_jobs';

  -- Get validation status
  SELECT workflow_validation_status INTO validation_status
  FROM production_jobs WHERE id = p_job_id;

  -- Generate warnings
  IF empty_stages > 0 THEN
    warning_list := array_append(warning_list, empty_stages || ' stages have no configuration');
  END IF;
  
  IF partial_stages > 0 THEN
    warning_list := array_append(warning_list, partial_stages || ' stages have incomplete configuration'); 
  END IF;
  
  IF total_duration_minutes = 0 THEN
    warning_list := array_append(warning_list, 'No duration estimates available');
  END IF;

  configuration_warnings := warning_list;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;