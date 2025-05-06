
-- Create an RPC function to safely get all users with their emails
-- This requires admin privileges and will only work when called by an admin
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE (id uuid, email text) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Check if the current user is an admin
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RETURN QUERY SELECT au.id, au.email::text 
      FROM auth.users au;
  ELSE
    -- Return empty set if not admin
    RETURN QUERY SELECT NULL::uuid, NULL::text WHERE false;
  END IF;
END;
$$;
