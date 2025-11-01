-- Minimal, safe changes without altering column type
-- 1) Promote James to sys_dev
UPDATE public.user_roles ur
SET role = 'sys_dev'
WHERE ur.user_id = (SELECT id FROM auth.users WHERE email = 'james@impressweb.co.za');

-- 2) Ensure sys_dev and admin have access to all divisions
CREATE OR REPLACE FUNCTION public.user_can_access_division(p_division text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sys dev and admins can access all divisions
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('sys_dev', 'admin')
  ) THEN
    RETURN true;
  END IF;

  -- Direct division assignment check
  RETURN EXISTS (
    SELECT 1 FROM public.user_division_assignments
    WHERE user_id = auth.uid() AND division_code = p_division
  );
END;
$$;

-- 3) Clean up division assignments for operational users to DIG only
-- Remove all current assignments for specified roles
DELETE FROM public.user_division_assignments uda
USING public.user_roles ur
WHERE uda.user_id = ur.user_id
  AND ur.role IN ('operator', 'dtp_operator', 'manager', 'user');

-- Reassign DIG as primary where missing
INSERT INTO public.user_division_assignments (user_id, division_code, is_primary, assigned_by)
SELECT ur.user_id, 'DIG', true,
       (SELECT id FROM auth.users WHERE email = 'james@impressweb.co.za')
FROM public.user_roles ur
WHERE ur.role IN ('operator', 'dtp_operator', 'manager', 'user')
  AND NOT EXISTS (
    SELECT 1 FROM public.user_division_assignments uda
    WHERE uda.user_id = ur.user_id AND uda.division_code = 'DIG'
  );