-- CLEAN FIX: Reset the 5 flyer jobs that were incorrectly assigned to business card batch
-- Step 1: Reset flyer jobs back to queued status
UPDATE flyer_jobs 
SET status = 'queued', batch_id = NULL, batch_allocated_at = NULL, batch_allocated_by = NULL
WHERE batch_id = 'afca733f-a9da-4e53-82d4-e8818be11ad6';

-- Step 2: Delete the incorrect batch job references
DELETE FROM batch_job_references 
WHERE batch_id = 'afca733f-a9da-4e53-82d4-e8818be11ad6' 
AND batch_job_table = 'flyer_jobs';

-- Step 3: Delete the incorrect business card batch that was created for flyer jobs
DELETE FROM batches 
WHERE id = 'afca733f-a9da-4e53-82d4-e8818be11ad6' 
AND name = 'DXB-BC-00011';