-- Extend allowed statuses to include 'changes_requested'
ALTER TABLE public.job_stage_instances
  DROP CONSTRAINT IF EXISTS job_stage_instances_status_check;

ALTER TABLE public.job_stage_instances
  ADD CONSTRAINT job_stage_instances_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'pending'::text,
        'active'::text,
        'completed'::text,
        'on_hold'::text,
        'reworked'::text,
        'awaiting_approval'::text,
        'changes_requested'::text
      ]
    )
  );