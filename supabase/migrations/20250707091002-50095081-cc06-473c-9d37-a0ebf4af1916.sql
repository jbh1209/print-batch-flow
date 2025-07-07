-- Restore database to yesterday 9:45 AM state by removing today's changes

-- Drop recently added columns from production_stages table
ALTER TABLE public.production_stages 
DROP COLUMN IF EXISTS master_queue_id,
DROP COLUMN IF EXISTS is_batch_stage,
DROP COLUMN IF EXISTS is_conditional,
DROP COLUMN IF EXISTS allows_concurrent_start,
DROP COLUMN IF EXISTS requires_all_parts_complete,
DROP COLUMN IF EXISTS part_specific_stages;

-- Remove today's migration entries from supabase schema migrations table
DELETE FROM supabase_migrations.schema_migrations 
WHERE version LIKE '20250707%';

-- Verify production_stages table structure matches expected state
-- The table should now only have: id, name, description, color, order_index, is_active, created_at, updated_at