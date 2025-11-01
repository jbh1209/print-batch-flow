-- Final admin normalization with ALL DEFAULT parameters preserved

CREATE OR REPLACE FUNCTION public.check_user_admin_status(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = check_user_id
      AND ur.role IN ('admin','sys_dev')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.check_user_admin_status(_user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.check_user_admin_status(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_admin_secure_fixed(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.check_user_admin_status(_user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_admin_secure_fixed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.check_user_admin_status(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_user_admin(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.check_user_admin_status(check_user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.check_user_admin_status(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_admin_simple()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.check_user_admin_status(auth.uid());
$$;

-- check_user_is_admin also has DEFAULT auth.uid()
CREATE OR REPLACE FUNCTION public.check_user_is_admin(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.check_user_admin_status(check_user_id);
$$;

CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE (id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.check_user_admin_status(auth.uid()) THEN
    RETURN QUERY SELECT au.id, au.email::text FROM auth.users au;
  ELSE
    RETURN QUERY SELECT NULL::uuid, NULL::text WHERE false;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_admin_status(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_secure_fixed(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_secure_fixed() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_simple() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_is_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_users() TO anon, authenticated;