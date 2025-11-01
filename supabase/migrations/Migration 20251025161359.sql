-- Add division column to batches table
ALTER TABLE public.batches 
ADD COLUMN division text NOT NULL DEFAULT 'DIG';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_batches_division ON public.batches(division);

-- Update existing batches to have proper division based on their name prefix
UPDATE public.batches
SET division = CASE
  WHEN name LIKE 'DXB-OFF-%' THEN 'OFF'
  WHEN name LIKE 'DXB-LFP-%' THEN 'LFP'
  WHEN name LIKE 'DXB-SCR-%' THEN 'SCR'
  ELSE 'DIG'
END;

COMMENT ON COLUMN public.batches.division IS 'Division code (DIG, OFF, LFP, SCR) for batch filtering';