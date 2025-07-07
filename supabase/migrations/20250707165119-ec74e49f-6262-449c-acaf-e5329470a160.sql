-- Remove the database constraint that enforces Batch Allocation stage ordering
-- This allows flexible positioning of batch allocation stages as needed

DROP TRIGGER IF EXISTS validate_stage_order_integrity_trigger ON category_production_stages;
DROP TRIGGER IF EXISTS validate_stage_order_trigger ON category_production_stages;
DROP FUNCTION IF EXISTS public.validate_stage_order_integrity() CASCADE;