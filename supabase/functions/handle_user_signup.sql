
-- Create or replace function to handle new user signup
-- This function creates a profile record when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Extract full_name from user metadata and create profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id, 
    CASE 
      WHEN new.raw_user_meta_data->>'full_name' IS NOT NULL THEN
        new.raw_user_meta_data->>'full_name'
      ELSE
        NULL
    END
  );
  
  -- Create default user role with proper column
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user');
  
  RETURN new;
END;
$$;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
