-- Part-Flag System Implementation - Phase 1: Database Schema Updates

-- Add supports_parts to production_stages table
ALTER TABLE public.production_stages 
ADD COLUMN supports_parts boolean NOT NULL DEFAULT false;

-- Add requires_part_assignment to categories table  
ALTER TABLE public.categories 
ADD COLUMN requires_part_assignment boolean NOT NULL DEFAULT false;

-- Add part_type to job_stage_instances table
ALTER TABLE public.job_stage_instances 
ADD COLUMN part_type text CHECK (part_type IS NULL OR part_type IN ('cover', 'text', 'insert'));

-- Add dependency_group for gathering dependencies
ALTER TABLE public.job_stage_instances 
ADD COLUMN dependency_group uuid;

-- Add comments for documentation
COMMENT ON COLUMN public.production_stages.supports_parts IS 'Indicates if this stage can handle part-specific work (cover/text/insert)';
COMMENT ON COLUMN public.categories.requires_part_assignment IS 'Indicates if jobs in this category require part assignment during allocation';
COMMENT ON COLUMN public.job_stage_instances.part_type IS 'Specifies which part of the job this stage instance handles (cover, text, insert, or null for whole job)';
COMMENT ON COLUMN public.job_stage_instances.dependency_group IS 'Groups stage instances that must complete before dependent stages can start (e.g., gathering waits for all parts)';