
-- This file will be executed during the next SQL migration to create the supporting database function
CREATE OR REPLACE FUNCTION public.get_table_columns(table_name text)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  columns_info JSONB;
BEGIN
  SELECT json_agg(json_build_object(
    'column_name', column_name,
    'data_type', data_type,
    'is_nullable', is_nullable,
    'column_default', column_default
  ))::jsonb INTO columns_info
  FROM information_schema.columns
  WHERE table_schema = 'public' 
  AND table_name = $1;

  RETURN columns_info;
END;
$$;

-- Grant execute permission to the anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_table_columns TO anon;
GRANT EXECUTE ON FUNCTION public.get_table_columns TO authenticated;

