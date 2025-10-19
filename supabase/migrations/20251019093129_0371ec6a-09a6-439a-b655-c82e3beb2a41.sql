-- Restore the get_all_users() RPC function to actually return users from auth.users
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE(id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Return all users from auth.users table
  RETURN QUERY 
  SELECT au.id, au.email::text
  FROM auth.users au
  ORDER BY au.created_at DESC;
END;
$function$;