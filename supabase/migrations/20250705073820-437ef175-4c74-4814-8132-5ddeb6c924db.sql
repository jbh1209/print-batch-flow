-- Run the repair function to fix missing batch job references
SELECT * FROM public.repair_missing_batch_references_fixed();