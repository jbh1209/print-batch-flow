-- Add unique constraint to prevent duplicate mappings
-- First, handle existing duplicates by keeping the one with highest confidence
WITH ranked_mappings AS (
  SELECT id, 
         excel_text, 
         production_stage_id,
         ROW_NUMBER() OVER (
           PARTITION BY excel_text, production_stage_id 
           ORDER BY confidence_score DESC, created_at DESC
         ) as rn
  FROM public.excel_import_mappings
),
duplicates_to_remove AS (
  SELECT id FROM ranked_mappings WHERE rn > 1
)
DELETE FROM public.excel_import_mappings 
WHERE id IN (SELECT id FROM duplicates_to_remove);

-- Add unique constraint on the combination of excel_text and production_stage_id
ALTER TABLE public.excel_import_mappings 
ADD CONSTRAINT excel_import_mappings_text_stage_unique 
UNIQUE (excel_text, production_stage_id);

-- Create function to handle mapping upserts with conflict resolution
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
        WHEN new_confidence >= 150 THEN true 
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
    
    -- Insert new mapping
    INSERT INTO public.excel_import_mappings (
      excel_text,
      production_stage_id,
      stage_specification_id,
      confidence_score,
      created_by,
      is_verified
    ) VALUES (
      p_excel_text,
      p_production_stage_id,
      p_stage_specification_id,
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

-- Create function to merge duplicate mappings and resolve conflicts
CREATE OR REPLACE FUNCTION public.consolidate_excel_mappings()
RETURNS TABLE(
  merged_count integer,
  conflict_count integer,
  consolidation_log jsonb
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  merge_count integer := 0;
  conflict_count integer := 0;
  log_entries jsonb := '[]'::jsonb;
  duplicate_record RECORD;
BEGIN
  -- Only allow admins to run consolidation
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required for mapping consolidation';
  END IF;
  
  -- Find and log conflicts (same text, different stages)
  FOR duplicate_record IN
    SELECT 
      excel_text,
      COUNT(DISTINCT production_stage_id) as stage_count,
      array_agg(DISTINCT production_stage_id) as stage_ids
    FROM public.excel_import_mappings
    GROUP BY excel_text
    HAVING COUNT(DISTINCT production_stage_id) > 1
  LOOP
    conflict_count := conflict_count + 1;
    log_entries := log_entries || jsonb_build_object(
      'type', 'conflict',
      'excel_text', duplicate_record.excel_text,
      'stage_count', duplicate_record.stage_count,
      'stage_ids', duplicate_record.stage_ids
    );
  END LOOP;
  
  RETURN QUERY SELECT merge_count, conflict_count, log_entries;
END;
$function$;