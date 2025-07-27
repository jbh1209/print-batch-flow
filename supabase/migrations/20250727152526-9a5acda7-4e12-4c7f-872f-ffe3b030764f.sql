-- Add missing foreign key constraint for stage_capacity_profiles
ALTER TABLE public.stage_capacity_profiles 
ADD CONSTRAINT fk_stage_capacity_profiles_production_stage_id 
FOREIGN KEY (production_stage_id) REFERENCES public.production_stages(id) 
ON DELETE CASCADE;