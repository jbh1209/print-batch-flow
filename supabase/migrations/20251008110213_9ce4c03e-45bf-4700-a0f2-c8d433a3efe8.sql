-- Fix stage_sub_tasks permissions to allow RPC function to create sub-tasks
-- This resolves the HP12000 multi-part stage issue where sub-tasks weren't being created

-- Grant necessary permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stage_sub_tasks TO authenticated;

-- Grant necessary permissions to service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stage_sub_tasks TO service_role;

-- Ensure the RPC function has necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Add comment for documentation
COMMENT ON TABLE public.stage_sub_tasks IS 'Stores sub-tasks for multi-specification stages like HP12000 with Cover/Text parts';
