-- Phase 1: Database Consistency Fix
-- Fix verification logic: Set is_verified = true for manual mappings with confidence 100+
UPDATE public.excel_import_mappings 
SET is_verified = true 
WHERE confidence_score >= 100;

-- Update the upsert_excel_mapping function to set is_verified = true for manual mappings
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
  prev_confidence integer := 0;
  new_confidence integer := p_confidence_score;
BEGIN
  -- Check for existing mapping with same text and stage
  SELECT * INTO existing_mapping
  FROM public.excel_import_mappings
  WHERE excel_text = p_excel_text 
    AND production_stage_id = p_production_stage_id;
  
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
        WHEN new_confidence >= 100 THEN true 
        ELSE is_verified 
      END
    WHERE id = existing_mapping.id;
    
    final_mapping_id := existing_mapping.id;
    action_result := 'updated';
  ELSE
    -- Check for conflicts (same text mapping to different stage)
    SELECT COUNT(*) INTO had_conflict
    FROM public.excel_import_mappings
    WHERE excel_text = p_excel_text 
      AND production_stage_id != p_production_stage_id;
    
    had_conflict := had_conflict > 0;
    
    -- Insert new mapping with proper verification
    INSERT INTO public.excel_import_mappings (
      excel_text,
      production_stage_id,
      stage_specification_id,
      confidence_score,
      created_by,
      is_verified,
      mapping_type
    ) VALUES (
      p_excel_text,
      p_production_stage_id,
      p_stage_specification_id,
      p_confidence_score,
      p_created_by,
      p_confidence_score >= 100,
      'production_stage'
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

-- Create functions for paper and delivery mappings if they don't exist
CREATE OR REPLACE FUNCTION public.upsert_paper_specification_mapping(
  p_excel_text text,
  p_paper_type_id uuid,
  p_paper_weight_id uuid,
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
  prev_confidence integer := 0;
  new_confidence integer := p_confidence_score;
BEGIN
  -- Check for existing mapping with same text and paper specs
  SELECT * INTO existing_mapping
  FROM public.excel_import_mappings
  WHERE excel_text = p_excel_text 
    AND paper_type_specification_id = p_paper_type_id
    AND paper_weight_specification_id = p_paper_weight_id
    AND mapping_type = 'paper_specification';
  
  IF existing_mapping.id IS NOT NULL THEN
    -- Update existing mapping
    prev_confidence := existing_mapping.confidence_score;
    new_confidence := GREATEST(existing_mapping.confidence_score + 10, p_confidence_score);
    
    UPDATE public.excel_import_mappings
    SET 
      confidence_score = new_confidence,
      updated_at = now(),
      is_verified = CASE 
        WHEN new_confidence >= 100 THEN true 
        ELSE is_verified 
      END
    WHERE id = existing_mapping.id;
    
    final_mapping_id := existing_mapping.id;
    action_result := 'updated';
  ELSE
    -- Check for conflicts
    SELECT COUNT(*) INTO had_conflict
    FROM public.excel_import_mappings
    WHERE excel_text = p_excel_text 
      AND mapping_type = 'paper_specification'
      AND (paper_type_specification_id != p_paper_type_id OR paper_weight_specification_id != p_paper_weight_id);
    
    had_conflict := had_conflict > 0;
    
    -- Insert new mapping
    INSERT INTO public.excel_import_mappings (
      excel_text,
      paper_type_specification_id,
      paper_weight_specification_id,
      confidence_score,
      created_by,
      is_verified,
      mapping_type
    ) VALUES (
      p_excel_text,
      p_paper_type_id,
      p_paper_weight_id,
      p_confidence_score,
      p_created_by,
      p_confidence_score >= 100,
      'paper_specification'
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

CREATE OR REPLACE FUNCTION public.upsert_delivery_specification_mapping(
  p_excel_text text,
  p_delivery_method_id uuid DEFAULT NULL,
  p_address_pattern text DEFAULT NULL,
  p_is_collection boolean DEFAULT false,
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
  prev_confidence integer := 0;
  new_confidence integer := p_confidence_score;
BEGIN
  -- Check for existing mapping
  SELECT * INTO existing_mapping
  FROM public.excel_import_mappings
  WHERE excel_text = p_excel_text 
    AND mapping_type = 'delivery_specification'
    AND COALESCE(delivery_method_specification_id::text, '') = COALESCE(p_delivery_method_id::text, '')
    AND is_collection_mapping = p_is_collection;
  
  IF existing_mapping.id IS NOT NULL THEN
    -- Update existing mapping
    prev_confidence := existing_mapping.confidence_score;
    new_confidence := GREATEST(existing_mapping.confidence_score + 10, p_confidence_score);
    
    UPDATE public.excel_import_mappings
    SET 
      confidence_score = new_confidence,
      address_extraction_pattern = COALESCE(p_address_pattern, address_extraction_pattern),
      updated_at = now(),
      is_verified = CASE 
        WHEN new_confidence >= 100 THEN true 
        ELSE is_verified 
      END
    WHERE id = existing_mapping.id;
    
    final_mapping_id := existing_mapping.id;
    action_result := 'updated';
  ELSE
    -- Check for conflicts
    SELECT COUNT(*) INTO had_conflict
    FROM public.excel_import_mappings
    WHERE excel_text = p_excel_text 
      AND mapping_type = 'delivery_specification'
      AND (COALESCE(delivery_method_specification_id::text, '') != COALESCE(p_delivery_method_id::text, '') 
           OR is_collection_mapping != p_is_collection);
    
    had_conflict := had_conflict > 0;
    
    -- Insert new mapping
    INSERT INTO public.excel_import_mappings (
      excel_text,
      delivery_method_specification_id,
      address_extraction_pattern,
      is_collection_mapping,
      confidence_score,
      created_by,
      is_verified,
      mapping_type
    ) VALUES (
      p_excel_text,
      p_delivery_method_id,
      p_address_pattern,
      p_is_collection,
      p_confidence_score,
      p_created_by,
      p_confidence_score >= 100,
      'delivery_specification'
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