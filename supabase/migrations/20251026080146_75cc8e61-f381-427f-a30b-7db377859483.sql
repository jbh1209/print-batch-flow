-- Update all admin-checking functions to recognize sys_dev as super admin
-- Drop and recreate functions properly

-- 1. Drop and recreate check_user_admin_status
DROP FUNCTION IF EXISTS public.check_user_admin_status(uuid);
CREATE FUNCTION public.check_user_admin_status(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = check_user_id 
    AND role IN ('sys_dev', 'admin')
  );
END;
$$;

-- 2. Update is_admin function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('sys_dev', 'admin')
  );
$$;

-- 3. Update is_admin_secure_fixed
CREATE OR REPLACE FUNCTION public.is_admin_secure_fixed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('sys_dev', 'admin')
  );
$$;

-- 4. Update is_user_admin
CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('sys_dev', 'admin')
  );
END;
$$;

-- 5. Update is_admin_simple
CREATE OR REPLACE FUNCTION public.is_admin_simple()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('sys_dev', 'admin')
  );
$$;

-- 6. Update any_admin_exists
CREATE OR REPLACE FUNCTION public.any_admin_exists()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE role IN ('sys_dev', 'admin')
  );
$$;

-- 7. Update check_admin_exists
CREATE OR REPLACE FUNCTION public.check_admin_exists()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE role IN ('sys_dev', 'admin')
  );
END;
$$;

-- 8. Update get_admin_status
CREATE OR REPLACE FUNCTION public.get_admin_status()
RETURNS TABLE (is_admin boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('sys_dev', 'admin')
  );
END;
$$;

-- 9. Drop and recreate get_admin_user_stats
DROP FUNCTION IF EXISTS public.get_admin_user_stats();
CREATE FUNCTION public.get_admin_user_stats()
RETURNS TABLE (
  total_users bigint,
  admin_users bigint,
  regular_users bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins and sys_devs to view stats
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('sys_dev', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    COUNT(DISTINCT ur.user_id)::bigint as total_users,
    COUNT(DISTINCT CASE WHEN ur.role IN ('sys_dev', 'admin') THEN ur.user_id END)::bigint as admin_users,
    COUNT(DISTINCT CASE WHEN ur.role NOT IN ('sys_dev', 'admin') THEN ur.user_id END)::bigint as regular_users
  FROM public.user_roles ur;
END;
$$;