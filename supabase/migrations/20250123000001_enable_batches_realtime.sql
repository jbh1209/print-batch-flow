
-- Enable replica identity for batches table to support real-time updates
ALTER TABLE public.batches REPLICA IDENTITY FULL;

-- Add batches table to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.batches;
