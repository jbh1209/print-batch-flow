-- Add tracking columns for print file dispatch confirmation
-- These columns track when DTP operator confirms files were sent to printer after auto-approval

ALTER TABLE job_stage_instances 
ADD COLUMN print_files_sent_to_printer_at TIMESTAMPTZ NULL,
ADD COLUMN print_files_sent_by UUID NULL;

-- Add index for efficient querying of unsent files
CREATE INDEX idx_job_stage_instances_print_files_sent 
ON job_stage_instances(print_files_sent_to_printer_at) 
WHERE proof_approved_manually_at IS NOT NULL;

COMMENT ON COLUMN job_stage_instances.print_files_sent_to_printer_at IS 'Timestamp when DTP operator confirmed print files were sent to printer';
COMMENT ON COLUMN job_stage_instances.print_files_sent_by IS 'User ID of DTP operator who confirmed files were sent';