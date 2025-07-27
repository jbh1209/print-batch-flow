-- Phase 1: Clean up duplicate RLS policies on user_roles table
-- Remove all existing policies first
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can update their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Allow admins to read user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Allow admins to manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Allow authenticated users to view user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.user_roles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.user_roles;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.user_roles;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_only" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_read_own" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_manage_admin" ON public.user_roles;

-- Create simplified, non-conflicting policies
CREATE POLICY "Allow admins to manage user roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

CREATE POLICY "Allow users to view their own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Phase 2: Fix app_settings access issues
-- Ensure app_settings has proper policies
DROP POLICY IF EXISTS "Anyone can read settings" ON public.app_settings;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.app_settings;

CREATE POLICY "Allow authenticated users to read app settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (true);

-- Phase 3: Optimize frequently used functions
CREATE OR REPLACE FUNCTION public.check_user_admin_status_optimized(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = check_user_id 
    AND role = 'admin'
    LIMIT 1
  );
END;
$$;