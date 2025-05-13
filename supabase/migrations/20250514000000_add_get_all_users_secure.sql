
-- Implementation of a secure function to get all users
CREATE OR REPLACE FUNCTION public.get_all_users_secure()
 RETURNS TABLE(id uuid, email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Only admins can access this function
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RETURN QUERY SELECT au.id, au.email::text 
      FROM auth.users au;
  ELSE
    -- Return empty set if not admin
    RETURN QUERY SELECT NULL::uuid, NULL::text WHERE false;
  END IF;
END;
$function$;
