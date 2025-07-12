-- Update the calculate_stage_duration function to accept quantity type parameter
CREATE OR REPLACE FUNCTION public.calculate_stage_duration_with_type(
  p_quantity integer, 
  p_running_speed_per_hour integer, 
  p_make_ready_time_minutes integer DEFAULT 10, 
  p_speed_unit text DEFAULT 'sheets_per_hour'::text,
  p_quantity_type text DEFAULT 'pieces'::text
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  production_minutes INTEGER;
  total_minutes INTEGER;
  effective_quantity INTEGER;
BEGIN
  -- Handle null or zero values
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_running_speed_per_hour IS NULL OR p_running_speed_per_hour <= 0 THEN
    RETURN COALESCE(p_make_ready_time_minutes, 10);
  END IF;
  
  -- Adjust quantity based on quantity type and stage requirements
  effective_quantity := p_quantity;
  
  -- For printing stages, typically use sheets
  -- For finishing stages, typically use pieces
  -- For operations, use the raw count
  CASE p_quantity_type
    WHEN 'sheets' THEN
      -- For sheet-based operations (printing), use quantity as-is
      effective_quantity := p_quantity;
    WHEN 'pieces' THEN
      -- For piece-based operations (finishing), use quantity as-is
      effective_quantity := p_quantity;
    WHEN 'operations' THEN
      -- For operation count, use quantity as-is
      effective_quantity := p_quantity;
    ELSE
      -- Default to pieces
      effective_quantity := p_quantity;
  END CASE;
  
  -- Calculate production time based on speed unit
  CASE p_speed_unit
    WHEN 'sheets_per_hour', 'items_per_hour', 'pieces_per_hour' THEN
      production_minutes := CEIL((effective_quantity::NUMERIC / p_running_speed_per_hour::NUMERIC) * 60);
    WHEN 'minutes_per_item', 'minutes_per_piece' THEN
      production_minutes := effective_quantity * p_running_speed_per_hour;
    ELSE
      production_minutes := CEIL((effective_quantity::NUMERIC / p_running_speed_per_hour::NUMERIC) * 60);
  END CASE;
  
  -- Add make-ready time
  total_minutes := production_minutes + COALESCE(p_make_ready_time_minutes, 10);
  
  RETURN total_minutes;
END;
$function$;