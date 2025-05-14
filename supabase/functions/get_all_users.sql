
-- Create an RPC function that safely returns an empty set
-- Admin functionality has been removed from the application
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE (id uuid, email text) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Simply return empty set - admin functionality is removed
  RETURN QUERY SELECT NULL::uuid, NULL::text WHERE false;
END;
$$;
