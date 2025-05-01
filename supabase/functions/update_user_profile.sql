
-- Create a function to update a user's profile name using a security definer
CREATE OR REPLACE FUNCTION public.update_user_profile_name(_user_id uuid, _full_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles
  SET full_name = _full_name
  WHERE id = _user_id;
END;
$$;
