
-- Adds a secure function to get all users with their roles
-- This prevents infinite recursion issues in RLS policies
CREATE OR REPLACE FUNCTION public.get_all_users_with_roles()
 RETURNS TABLE(id uuid, email text, role text, full_name text, avatar_url text, created_at timestamptz, last_sign_in_at timestamptz)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Only admins can access this function
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RETURN QUERY 
      SELECT 
        au.id, 
        au.email::text,
        COALESCE(ur.role::text, 'user'::text) as role,
        p.full_name,
        p.avatar_url,
        au.created_at,
        au.last_sign_in_at
      FROM auth.users au
      LEFT JOIN public.profiles p ON p.id = au.id
      LEFT JOIN public.user_roles ur ON ur.user_id = au.id;
  ELSE
    -- Return empty set if not admin
    RETURN QUERY SELECT 
      NULL::uuid, 
      NULL::text,
      NULL::text,
      NULL::text,
      NULL::text,
      NULL::timestamptz,
      NULL::timestamptz
    WHERE false;
  END IF;
END;
$function$;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_all_users_with_roles IS 'Securely retrieve all users with their roles and profile information. Only admins can access this function.';
