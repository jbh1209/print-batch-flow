-- Fix RLS policy for app_settings table
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Add policy to allow authenticated users to read app_settings
CREATE POLICY "authenticated_read_app_settings" 
ON public.app_settings 
FOR SELECT 
TO authenticated
USING (true);