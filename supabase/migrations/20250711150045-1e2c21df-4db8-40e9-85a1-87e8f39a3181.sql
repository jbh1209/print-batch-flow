-- Extend excel_import_mappings table to support multiple mapping types
-- Add mapping_type enum and print_specification_id for paper/delivery mappings

-- Create enum for mapping types
CREATE TYPE mapping_type AS ENUM ('production_stage', 'print_specification');

-- Add new columns to excel_import_mappings table
ALTER TABLE public.excel_import_mappings 
ADD COLUMN mapping_type mapping_type DEFAULT 'production_stage',
ADD COLUMN print_specification_id uuid REFERENCES public.print_specifications(id);

-- Create index for better performance
CREATE INDEX idx_excel_mappings_type ON public.excel_import_mappings(mapping_type);
CREATE INDEX idx_excel_mappings_print_spec ON public.excel_import_mappings(print_specification_id);

-- Update existing records to have the correct mapping type
UPDATE public.excel_import_mappings 
SET mapping_type = 'production_stage' 
WHERE mapping_type IS NULL;

-- Create new upsert function for print specifications
CREATE OR REPLACE FUNCTION public.upsert_print_specification_mapping(
  p_excel_text text,
  p_print_specification_id uuid,
  p_confidence_score integer DEFAULT 100,
  p_created_by uuid DEFAULT auth.uid()
)
RETURNS TABLE(
  mapping_id uuid,
  action_taken text,
  previous_confidence integer,
  new_confidence integer,
  conflict_detected boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  existing_mapping RECORD;
  final_mapping_id uuid;
  action_result text;
  had_conflict boolean := false;
  conflict_count integer := 0;
  prev_confidence integer := 0;
  new_confidence integer := p_confidence_score;
BEGIN
  -- Check for existing mapping with same text and specification
  SELECT * INTO existing_mapping
  FROM public.excel_import_mappings
  WHERE excel_text = p_excel_text 
    AND print_specification_id = p_print_specification_id
    AND mapping_type = 'print_specification';
  
  IF existing_mapping.id IS NOT NULL THEN
    -- Update existing mapping with higher confidence
    prev_confidence := existing_mapping.confidence_score;
    new_confidence := GREATEST(existing_mapping.confidence_score + 10, p_confidence_score);
    
    UPDATE public.excel_import_mappings
    SET 
      confidence_score = new_confidence,
      updated_at = now(),
      is_verified = CASE 
        WHEN new_confidence >= 150 THEN true 
        ELSE is_verified 
      END
    WHERE id = existing_mapping.id;
    
    final_mapping_id := existing_mapping.id;
    action_result := 'updated';
  ELSE
    -- Check for conflicts (same text mapping to different print specifications)
    SELECT COUNT(*) INTO conflict_count
    FROM public.excel_import_mappings
    WHERE excel_text = p_excel_text 
      AND mapping_type = 'print_specification'
      AND print_specification_id != p_print_specification_id;
    
    had_conflict := conflict_count > 0;
    
    -- Insert new mapping
    INSERT INTO public.excel_import_mappings (
      excel_text,
      print_specification_id,
      mapping_type,
      confidence_score,
      created_by,
      is_verified
    ) VALUES (
      p_excel_text,
      p_print_specification_id,
      'print_specification',
      p_confidence_score,
      p_created_by,
      p_confidence_score >= 150
    )
    RETURNING id INTO final_mapping_id;
    
    action_result := 'created';
  END IF;
  
  RETURN QUERY SELECT 
    final_mapping_id,
    action_result,
    prev_confidence,
    new_confidence,
    had_conflict;
END;
$function$;

-- Update existing upsert_excel_mapping function to work with mapping_type
CREATE OR REPLACE FUNCTION public.upsert_excel_mapping(
  p_excel_text text,
  p_production_stage_id uuid,
  p_stage_specification_id uuid DEFAULT NULL,
  p_confidence_score integer DEFAULT 100,
  p_created_by uuid DEFAULT auth.uid()
)
RETURNS TABLE(
  mapping_id uuid,
  action_taken text,
  previous_confidence integer,
  new_confidence integer,
  conflict_detected boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  existing_mapping RECORD;
  final_mapping_id uuid;
  action_result text;
  had_conflict boolean := false;
  conflict_count integer := 0;
  prev_confidence integer := 0;
  new_confidence integer := p_confidence_score;
BEGIN
  -- Check for existing mapping with same text and stage
  SELECT * INTO existing_mapping
  FROM public.excel_import_mappings
  WHERE excel_text = p_excel_text 
    AND production_stage_id = p_production_stage_id
    AND mapping_type = 'production_stage';
  
  IF existing_mapping.id IS NOT NULL THEN
    -- Update existing mapping with higher confidence
    prev_confidence := existing_mapping.confidence_score;
    new_confidence := GREATEST(existing_mapping.confidence_score + 10, p_confidence_score);
    
    UPDATE public.excel_import_mappings
    SET 
      confidence_score = new_confidence,
      stage_specification_id = COALESCE(p_stage_specification_id, stage_specification_id),
      updated_at = now(),
      is_verified = CASE 
        WHEN new_confidence >= 150 THEN true 
        ELSE is_verified 
      END
    WHERE id = existing_mapping.id;
    
    final_mapping_id := existing_mapping.id;
    action_result := 'updated';
  ELSE
    -- Check for conflicts (same text mapping to different stages)
    SELECT COUNT(*) INTO conflict_count
    FROM public.excel_import_mappings
    WHERE excel_text = p_excel_text 
      AND mapping_type = 'production_stage'
      AND production_stage_id != p_production_stage_id;
    
    had_conflict := conflict_count > 0;
    
    -- Insert new mapping
    INSERT INTO public.excel_import_mappings (
      excel_text,
      production_stage_id,
      stage_specification_id,
      mapping_type,
      confidence_score,
      created_by,
      is_verified
    ) VALUES (
      p_excel_text,
      p_production_stage_id,
      p_stage_specification_id,
      'production_stage',
      p_confidence_score,
      p_created_by,
      p_confidence_score >= 150
    )
    RETURNING id INTO final_mapping_id;
    
    action_result := 'created';
  END IF;
  
  RETURN QUERY SELECT 
    final_mapping_id,
    action_result,
    prev_confidence,
    new_confidence,
    had_conflict;
END;
$function$;