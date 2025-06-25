
-- Fix existing jobs that have categories but NULL due_dates
-- Calculate due_date as created_at + category.sla_target_days
UPDATE production_jobs 
SET due_date = (production_jobs.created_at::date + INTERVAL '1 day' * COALESCE(c.sla_target_days, 3))::date,
    updated_at = now()
FROM categories c 
WHERE production_jobs.category_id = c.id 
  AND production_jobs.due_date IS NULL 
  AND production_jobs.created_at IS NOT NULL;

-- Also fix any jobs that might have been created without proper due dates
-- For jobs without categories, use a default 3-day SLA
UPDATE production_jobs 
SET due_date = (production_jobs.created_at::date + INTERVAL '3 days')::date,
    updated_at = now()
WHERE production_jobs.due_date IS NULL 
  AND production_jobs.created_at IS NOT NULL 
  AND production_jobs.category_id IS NULL;
