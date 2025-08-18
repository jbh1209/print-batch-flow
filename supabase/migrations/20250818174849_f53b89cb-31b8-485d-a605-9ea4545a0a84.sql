-- Create view for jobs ready for production
CREATE OR REPLACE VIEW v_jobs_ready_for_production AS
SELECT
  j.*,
  (j.proof_approved_at IS NOT NULL) AS is_ready_for_production
FROM production_jobs j;