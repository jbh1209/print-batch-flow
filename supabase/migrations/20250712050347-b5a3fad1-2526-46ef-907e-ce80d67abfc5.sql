-- Make production_stage_id nullable for paper and delivery mappings
-- since these mapping types don't require a production stage
ALTER TABLE public.excel_import_mappings 
ALTER COLUMN production_stage_id DROP NOT NULL;