-- Add original_committed_due_date field to track the first due date given to client
ALTER TABLE production_jobs 
ADD COLUMN original_committed_due_date TIMESTAMP WITH TIME ZONE NULL;

-- Add helpful comment
COMMENT ON COLUMN production_jobs.original_committed_due_date IS 'The original due date committed to client at approval time - never changes once set';