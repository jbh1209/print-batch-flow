-- Revert the foreign key constraint that's causing the 406 errors
ALTER TABLE public.stage_capacity_profiles 
DROP CONSTRAINT IF EXISTS stage_capacity_profiles_production_stage_id_fkey;

-- Also remove any problematic indexes that might have been created
DROP INDEX IF EXISTS idx_stage_capacity_profiles_production_stage_id;