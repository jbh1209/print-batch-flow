-- Fix existing cover/text parallel processing
-- Step 1: Ensure all 'both' stages have a dependency_group
UPDATE job_stage_instances
SET dependency_group = gen_random_uuid()
WHERE part_assignment = 'both' 
  AND dependency_group IS NULL;

-- Step 2: Assign the same dependency_group to immediate predecessor cover/text stages
WITH boths AS (
  SELECT id as both_id, job_id, stage_order, dependency_group
  FROM job_stage_instances
  WHERE part_assignment = 'both' AND dependency_group IS NOT NULL
),
prev_cover AS (
  SELECT b.both_id, j.id as part_id, b.dependency_group
  FROM boths b
  JOIN LATERAL (
    SELECT id
    FROM job_stage_instances
    WHERE job_id = b.job_id
      AND part_assignment = 'cover'
      AND stage_order < b.stage_order
    ORDER BY stage_order DESC
    LIMIT 1
  ) j ON true
),
prev_text AS (
  SELECT b.both_id, j.id as part_id, b.dependency_group
  FROM boths b
  JOIN LATERAL (
    SELECT id
    FROM job_stage_instances
    WHERE job_id = b.job_id
      AND part_assignment = 'text'
      AND stage_order < b.stage_order
    ORDER BY stage_order DESC
    LIMIT 1
  ) j ON true
),
to_update AS (
  SELECT * FROM prev_cover
  UNION ALL
  SELECT * FROM prev_text
)
UPDATE job_stage_instances j
SET dependency_group = u.dependency_group
FROM to_update u
WHERE j.id = u.part_id
  AND (j.dependency_group IS DISTINCT FROM u.dependency_group);