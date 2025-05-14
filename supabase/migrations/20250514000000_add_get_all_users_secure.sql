
-- Drop the previous function that was causing errors
DROP FUNCTION IF EXISTS public.get_all_users_secure();

-- Implementation of a revised secure function that doesn't check user_roles.role
CREATE OR REPLACE FUNCTION public.get_all_users_secure()
 RETURNS TABLE(id uuid, email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Simply return empty set - admin functionality is removed
  RETURN QUERY SELECT NULL::uuid, NULL::text WHERE false;
END;
$function$;
