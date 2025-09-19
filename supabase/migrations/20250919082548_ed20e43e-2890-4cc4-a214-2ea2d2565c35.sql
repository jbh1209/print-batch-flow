-- Phase 4: Technical Infrastructure - Database Enhancements (Fixed)

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
ADD COLUMN IF NOT EXISTS workflow_validation_status TEXT DEFAULT 'unvalidated';

-- Add check constraint for workflow validation status (separate from column creation)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_workflow_validation_status') THEN
    ALTER TABLE production_jobs 
    ADD CONSTRAINT chk_workflow_validation_status 
    CHECK (workflow_validation_status IN ('valid', 'invalid', 'unvalidated', 'warning'));
  END IF;
END $$;

-- Add workflow last modified timestamp
ALTER TABLE production_jobs 
ADD COLUMN IF NOT EXISTS workflow_last_modified_at TIMESTAMPTZ DEFAULT now();

-- Create indexes for performance on configuration queries
CREATE INDEX IF NOT EXISTS idx_job_stage_instances_config_completeness 
ON job_stage_instances (job_id, configuration_completeness_score, status);

CREATE INDEX IF NOT EXISTS idx_job_stage_instances_workflow_lookup 
ON job_stage_instances (job_id, job_table_name, stage_order, status);

CREATE INDEX IF NOT EXISTS idx_production_jobs_workflow_status 
ON production_jobs (has_custom_workflow, workflow_validation_status, proof_approved_at);

-- Add constraints to ensure data integrity (with proper syntax)
DO $$ 
BEGIN
  -- Stage order must be positive
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_stage_order_positive') THEN
    ALTER TABLE job_stage_instances 
    ADD CONSTRAINT chk_stage_order_positive 
    CHECK (stage_order > 0);
  END IF;
  
  -- Duration must be positive when set
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_duration_positive') THEN
    ALTER TABLE job_stage_instances 
    ADD CONSTRAINT chk_duration_positive 
    CHECK (estimated_duration_minutes IS NULL OR estimated_duration_minutes > 0);
  END IF;
  
  -- Quantity must be positive when set
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_quantity_positive') THEN
    ALTER TABLE job_stage_instances 
    ADD CONSTRAINT chk_quantity_positive 
    CHECK (quantity IS NULL OR quantity > 0);
  END IF;
END $$;