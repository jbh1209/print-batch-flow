
-- 1. Add a column for explicit per-stage job ordering
ALTER TABLE public.job_stage_instances
ADD COLUMN job_order_in_stage integer;

-- 2. Initialize job_order_in_stage for all existing stage instances
-- Each stage independently: assign consecutive values per (production_stage_id, job_table_name)
UPDATE public.job_stage_instances jsi
SET job_order_in_stage = sub.row_num
FROM (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY production_stage_id, job_table_name
      ORDER BY COALESCE(started_at, created_at) ASC, id
    ) AS row_num
  FROM public.job_stage_instances
) sub
WHERE jsi.id = sub.id;

-- 3. Make job_order_in_stage required (NOT NULL) and default for new records
ALTER TABLE public.job_stage_instances 
ALTER COLUMN job_order_in_stage SET NOT NULL,
ALTER COLUMN job_order_in_stage SET DEFAULT 1;

-- 4. Create an index for efficient ordering in UI
CREATE INDEX IF NOT EXISTS idx_job_stage_order
ON public.job_stage_instances (production_stage_id, job_table_name, job_order_in_stage);

