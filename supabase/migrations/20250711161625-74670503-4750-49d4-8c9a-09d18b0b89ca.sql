-- Update excel_import_mappings table to support separate paper and delivery mapping
ALTER TABLE public.excel_import_mappings 
ADD COLUMN paper_type_specification_id uuid REFERENCES public.print_specifications(id),
ADD COLUMN paper_weight_specification_id uuid REFERENCES public.print_specifications(id),
ADD COLUMN delivery_method_specification_id uuid REFERENCES public.print_specifications(id),
ADD COLUMN address_extraction_pattern text,
ADD COLUMN is_collection_mapping boolean DEFAULT false;

-- Update the mapping_type enum to include new types
ALTER TYPE mapping_type ADD VALUE IF NOT EXISTS 'paper_specification';
ALTER TYPE mapping_type ADD VALUE IF NOT EXISTS 'delivery_specification';

-- Create function to handle paper specification mapping
CREATE OR REPLACE FUNCTION public.upsert_paper_specification_mapping(
  p_excel_text text,
  p_paper_type_id uuid,
  p_paper_weight_id uuid,
  p_confidence_score integer DEFAULT 100,
  p_created_by uuid DEFAULT auth.uid()
) RETURNS TABLE(
  mapping_id uuid,
  action_taken text,
  previous_confidence integer,
  new_confidence integer,
  conflict_detected boolean
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  existing_mapping RECORD;
  final_mapping_id uuid;
  action_result text;
  had_conflict boolean := false;
  prev_confidence integer := 0;
  new_confidence integer := p_confidence_score;
BEGIN
  -- Check for existing mapping with same text and paper specifications
  SELECT * INTO existing_mapping
  FROM public.excel_import_mappings
  WHERE excel_text = p_excel_text 
    AND paper_type_specification_id = p_paper_type_id
    AND paper_weight_specification_id = p_paper_weight_id
    AND mapping_type = 'paper_specification';
  
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
    -- Check for conflicts (same text mapping to different specifications)
    SELECT COUNT(*) > 0 INTO had_conflict
    FROM public.excel_import_mappings
    WHERE excel_text = p_excel_text 
      AND mapping_type = 'paper_specification'
      AND (paper_type_specification_id != p_paper_type_id OR paper_weight_specification_id != p_paper_weight_id);
    
    -- Insert new mapping
    INSERT INTO public.excel_import_mappings (
      excel_text,
      paper_type_specification_id,
      paper_weight_specification_id,
      mapping_type,
      confidence_score,
      created_by,
      is_verified
    ) VALUES (
      p_excel_text,
      p_paper_type_id,
      p_paper_weight_id,
      'paper_specification',
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
$$;

-- Create function to handle delivery specification mapping
CREATE OR REPLACE FUNCTION public.upsert_delivery_specification_mapping(
  p_excel_text text,
  p_delivery_method_id uuid DEFAULT NULL,
  p_address_pattern text DEFAULT NULL,
  p_is_collection boolean DEFAULT false,
  p_confidence_score integer DEFAULT 100,
  p_created_by uuid DEFAULT auth.uid()
) RETURNS TABLE(
  mapping_id uuid,
  action_taken text,
  previous_confidence integer,
  new_confidence integer,
  conflict_detected boolean
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  existing_mapping RECORD;
  final_mapping_id uuid;
  action_result text;
  had_conflict boolean := false;
  prev_confidence integer := 0;
  new_confidence integer := p_confidence_score;
BEGIN
  -- Check for existing mapping with same text and delivery specification
  SELECT * INTO existing_mapping
  FROM public.excel_import_mappings
  WHERE excel_text = p_excel_text 
    AND delivery_method_specification_id = p_delivery_method_id
    AND is_collection_mapping = p_is_collection
    AND mapping_type = 'delivery_specification';
  
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
        WHEN new_confidence >= 150 THEN true 
        ELSE is_verified 
      END
    WHERE id = existing_mapping.id;
    
    final_mapping_id := existing_mapping.id;
    action_result := 'updated';
  ELSE
    -- Check for conflicts
    SELECT COUNT(*) > 0 INTO had_conflict
    FROM public.excel_import_mappings
    WHERE excel_text = p_excel_text 
      AND mapping_type = 'delivery_specification'
      AND (delivery_method_specification_id != p_delivery_method_id OR is_collection_mapping != p_is_collection);
    
    -- Insert new mapping
    INSERT INTO public.excel_import_mappings (
      excel_text,
      delivery_method_specification_id,
      address_extraction_pattern,
      is_collection_mapping,
      mapping_type,
      confidence_score,
      created_by,
      is_verified
    ) VALUES (
      p_excel_text,
      p_delivery_method_id,
      p_address_pattern,
      p_is_collection,
      'delivery_specification',
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
$$;