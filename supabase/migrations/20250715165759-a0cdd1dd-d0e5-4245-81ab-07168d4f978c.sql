-- Insert default SLA settings
INSERT INTO app_settings (setting_type, product_type, sla_target_days) 
VALUES ('sla', 'production_jobs', 3)
ON CONFLICT DO NOTHING;

-- Update the existing job with a due date (3 business days from creation)
UPDATE production_jobs 
SET due_date = date_created + INTERVAL '3 days'
WHERE wo_no = 'D425566' AND due_date IS NULL;