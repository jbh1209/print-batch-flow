# Emergency Stabilization Procedures

## Overview
This document contains emergency SQL scripts and procedures to stabilize the production system when divisions are causing data visibility issues or the dependency_group assignments are broken.

**Status**: Active as of emergency on [DATE]
**Reason**: Supabase restore failure - cannot rollback to Friday night backup

---

## Phase A: Division Bypass (App Layer)

**Status**: ✅ Implemented in code

The app now checks `VITE_DISABLE_DIVISIONS=true` in `.env` to bypass all division filtering.

- When enabled, `useEnhancedProductionJobs` and `useAccessibleJobs` ignore `divisionFilter` parameters
- All jobs are visible regardless of division assignment or user division access
- DivisionSelector UI remains visible but does not affect queries

**To disable divisions**: Set `VITE_DISABLE_DIVISIONS=true` in `.env` (already done)
**To re-enable divisions**: Set `VITE_DISABLE_DIVISIONS=false` in `.env`

---

## Phase B: Temporary RLS Policies

**Status**: ⚠️ Requires manual SQL execution

### Purpose
Add temporary "fail-open" RLS policies that allow authenticated users to read and minimally update production data without division checks.

### SQL to Run (Supabase SQL Editor)

```sql
-- Enable RLS (should already be enabled)
ALTER TABLE public.production_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_stage_instances ENABLE ROW LEVEL SECURITY;

-- Temporary read policies for authenticated users
DROP POLICY IF EXISTS emergency_read_all_jobs ON public.production_jobs;
CREATE POLICY emergency_read_all_jobs
ON public.production_jobs
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS emergency_read_all_stages ON public.job_stage_instances;
CREATE POLICY emergency_read_all_stages
ON public.job_stage_instances
FOR SELECT
TO authenticated
USING (true);

-- Minimal write needed for operators: update stage instances (start/complete)
DROP POLICY IF EXISTS emergency_update_stages ON public.job_stage_instances;
CREATE POLICY emergency_update_stages
ON public.job_stage_instances
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Optional: If UI needs to update production_jobs status manually
-- Uncomment ONLY if truly needed:
-- DROP POLICY IF EXISTS emergency_update_jobs ON public.production_jobs;
-- CREATE POLICY emergency_update_jobs
-- ON public.production_jobs
-- FOR UPDATE
-- TO authenticated
-- USING (true)
-- WITH CHECK (true);
```

### Cleanup (when Supabase restore completes)

```sql
-- Remove all emergency policies
DROP POLICY IF EXISTS emergency_read_all_jobs ON public.production_jobs;
DROP POLICY IF EXISTS emergency_read_all_stages ON public.job_stage_instances;
DROP POLICY IF EXISTS emergency_update_stages ON public.job_stage_instances;
DROP POLICY IF EXISTS emergency_update_jobs ON public.production_jobs; -- if created

-- Reinstate proper division-aware RLS policies per docs/divisions.md
```

---

## Phase C: Dependency Group Repair

**Status**: ⚠️ Run as needed for affected jobs

### Problem
Jobs with cover/text parallel workflows may have `NULL` or fragmented `dependency_group` values, preventing 'both' stages from activating when parallel paths complete.

### Solution 1: Bulk Repair (All Jobs)

Run this to fix all jobs with parallel workflows:

```sql
WITH merge_points AS (
  SELECT job_id,
         MIN(stage_order) AS merge_order
  FROM job_stage_instances
  WHERE job_table_name = 'production_jobs'
    AND part_assignment = 'both'
  GROUP BY job_id
),
assignments AS (
  SELECT jsi.id,
         jsi.job_id,
         COALESCE(jsi.dependency_group, gen_random_uuid()) OVER (PARTITION BY jsi.job_id) AS shared_group
  FROM job_stage_instances jsi
  JOIN merge_points mp ON mp.job_id = jsi.job_id
  WHERE jsi.job_table_name = 'production_jobs'
    AND (
      (jsi.part_assignment IN ('cover','text') AND jsi.stage_order < mp.merge_order)
      OR
      (jsi.part_assignment = 'both' AND jsi.stage_order >= mp.merge_order)
    )
)
UPDATE job_stage_instances j
SET dependency_group = a.shared_group
FROM assignments a
WHERE j.id = a.id
  AND (j.dependency_group IS DISTINCT FROM a.shared_group);
```

**What it does**:
1. Finds the first 'both' stage for each job (the merge point)
2. Assigns the same `dependency_group` UUID to:
   - All cover/text stages before the merge point
   - All 'both' stages at or after the merge point
3. Reuses existing `dependency_group` if present, generates new UUID if NULL
4. Updates only rows where `dependency_group` differs

### Solution 2: Single Job Fix by WO Number

For immediate fix of a specific job (e.g., D427293):

```sql
-- Step 1: Find job ID
SELECT id FROM production_jobs WHERE wo_no = 'D427293';
-- Copy the returned UUID

-- Step 2: Fix dependency groups for this job
-- Replace :job_id with the UUID from step 1
WITH merge AS (
  SELECT job_id, MIN(stage_order) AS merge_order
  FROM job_stage_instances
  WHERE job_table_name = 'production_jobs'
    AND job_id = ':job_id'
    AND part_assignment = 'both'
  GROUP BY job_id
),
g AS (SELECT gen_random_uuid() AS grp)
UPDATE job_stage_instances j
SET dependency_group = g.grp
FROM merge m, g
WHERE j.job_id = m.job_id
  AND j.job_table_name = 'production_jobs'
  AND (
    (j.part_assignment IN ('cover','text') AND j.stage_order < m.merge_order)
    OR
    (j.part_assignment = 'both' AND j.stage_order >= m.merge_order)
  );
```

### Solution 3: Re-trigger Scheduler for Fixed Job

After running the dependency group fix, re-trigger the scheduler for the job:

**Via Browser Console (logged in):**
```javascript
const { data, error } = await supabase.functions.invoke('simple-scheduler', {
  body: { 
    commit: true, 
    onlyIfUnset: true, 
    onlyJobIds: ['<job-uuid-here>'] 
  }
});
console.log('Scheduler result:', data, error);
```

**Via curl:**
```bash
curl -X POST https://kgizusgqexmlfcqfjopk.functions.supabase.co/simple-scheduler \
  -H "Authorization: Bearer <anon_or_service_key>" \
  -H "Content-Type: application/json" \
  -d '{"commit": true, "onlyIfUnset": true, "onlyJobIds": ["<job-uuid-here>"]}'
```

---

## Verification Checklist

After implementing emergency fixes:

- [ ] Jobs list shows expected work orders regardless of division choice
- [ ] Can start/complete a stage without RLS errors
- [ ] Completing only cover OR only text does not activate 'both' stages
- [ ] Completing both cover AND text activates the first 'both' stage
- [ ] Schedule board populates for pending stages after scheduler runs
- [ ] D427293 appears in schedule after fix and re-trigger

---

## Rollback Plan

When Supabase completes the Friday night restore:

1. **Remove emergency RLS policies** (see Phase B cleanup above)
2. **Set `VITE_DISABLE_DIVISIONS=false`** in `.env`
3. **Reinstate division-aware RLS** per `docs/divisions.md`
4. **Verify proper division filtering** works for all users
5. **Archive this document** or mark as inactive

---

## Notes

- Emergency policies are intentionally permissive - use only during outage
- Dependency group fixes are safe and idempotent - can run multiple times
- These changes do NOT fix the scheduler-division coupling - that requires proper redesign per the deferred divisions plan
- Do NOT use these procedures as permanent solutions
