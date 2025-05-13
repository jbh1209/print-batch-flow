
-- Function to get all users with roles in a secure way
CREATE OR REPLACE FUNCTION public.get_all_users_with_roles()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  avatar_url text,
  role text,
  created_at timestamptz,
  last_sign_in_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only admins can access this function
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RETURN QUERY 
    SELECT 
      au.id,
      au.email::text,
      p.full_name,
      p.avatar_url,
      ur.role::text,
      au.created_at,
      au.last_sign_in_at
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    LEFT JOIN public.user_roles ur ON ur.user_id = au.id
    WHERE au.deleted_at IS NULL;
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
$$;
