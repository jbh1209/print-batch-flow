# Scheduler Restoration Implementation Plan
## Phase 1 Complete ✅

**Date**: 2025-11-07  
**Status**: EXTRACTION AND DOCUMENTATION COMPLETE

## What Was Delivered

### 1. Restoration SQL Files ✅
- `docs/restore_oct_24_working_scheduler.sql` - Part 1 (place_duration_sql, find_available_gaps)
- `docs/restore_oct_24_working_scheduler_part2.sql` - Part 2 (scheduler_reschedule_all_parallel_aware - Phase 1 FIFO)
- `docs/restore_oct_24_working_scheduler_part3.sql` - Part 3 (Phase 2 gap-filling, wrappers, cron function)

### 2. Schema Documentation ✅
- `docs/scheduler_schema_snapshot_oct24.md` - Complete schema reference with:
  - Actual column names used by scheduler
  - Common breaking changes to avoid
  - Part-aware filtering logic
  - Validation checklist
  - Recovery procedures

### 3. Extracted Functions (October 24-25, 2025 DB Dump) ✅
All functions extracted from **working state** before breaking changes:
- ✅ `scheduler_reschedule_all_parallel_aware()` - Main scheduler with Phase 1 & 2
- ✅ `find_available_gaps()` - Gap detection with conflict safety
- ✅ `place_duration_sql()` - Slot placement with lunch breaks
- ✅ `simple_scheduler_wrapper()` - Timeout-protected wrapper
- ✅ `cron_nightly_reschedule_with_carryforward()` - Nightly cron job

## Next Steps (Phase 2: Schema Validation)

### Action Items for User

Before restoring the functions, you should:

1. **Review the extracted SQL files** in `docs/restore_oct_24_working_scheduler*.sql`
   - These are the EXACT functions from October 24-25 when scheduler was working
   - No modifications have been made - this is the golden source

2. **Run schema validation query** from `docs/scheduler_schema_snapshot_oct24.md`:
   ```sql
   SELECT 
     table_name,
     column_name,
     data_type,
     is_nullable
   FROM information_schema.columns
   WHERE table_name IN (
     'job_stage_instances',
     'production_stages',
     'stage_time_slots',
     'production_jobs',
     'schedule_gap_fills'
   )
   ORDER BY table_name, ordinal_position;
   ```

3. **Compare current schema** against October 24 snapshot
   - Verify `job_stage_instances.status` exists (NOT `stage_status`)
   - Verify no column name mismatches
   - Check for any missing tables/columns

4. **Decide on restoration approach**:
   - **Option A**: Full restoration (run all 3 SQL files in order)
   - **Option B**: Incremental restoration (one function at a time with testing)
   - **Option C**: Schema fixes first, then restore functions

## Phase 3: Controlled Restoration (Pending User Decision)

### If you proceed with restoration:

#### Option A: Full Atomic Restoration
```sql
BEGIN;  -- Start transaction

-- Run all 3 restoration files
\i docs/restore_oct_24_working_scheduler.sql
\i docs/restore_oct_24_working_scheduler_part2.sql
\i docs/restore_oct_24_working_scheduler_part3.sql

-- Verify functions exist
SELECT proname FROM pg_proc WHERE proname LIKE 'scheduler_%';

-- Test wrapper (dry run)
SELECT * FROM simple_scheduler_wrapper('reschedule_all', now() + interval '1 day');

-- If all good:
COMMIT;

-- If issues:
ROLLBACK;
```

#### Option B: Incremental Function-by-Function
1. Restore `place_duration_sql` → Test
2. Restore `find_available_gaps` → Test with D427310 stage
3. Restore `scheduler_reschedule_all_parallel_aware` → Test full run
4. Restore wrappers → Test end-to-end

#### Option C: Schema Fixes First
If schema has drifted:
1. Run schema validation query
2. Create migration to fix column references
3. Then run restoration SQL

## Forensic Analysis - D427310 Gap Issue

Once functions are restored, you should:

1. **Query D427310's current schedule**:
   ```sql
   SELECT 
     jsi.id,
     ps.name,
     jsi.scheduled_start_at,
     jsi.scheduled_end_at,
     jsi.stage_order,
     jsi.part_assignment,
     LAG(jsi.scheduled_end_at) OVER (ORDER BY jsi.stage_order) as prev_end
   FROM job_stage_instances jsi
   JOIN production_stages ps ON ps.id = jsi.production_stage_id
   JOIN production_jobs pj ON pj.id = jsi.job_id
   WHERE pj.wo_no = 'D427310'
   ORDER BY jsi.stage_order;
   ```

2. **Check gap-filling configuration**:
   ```sql
   SELECT id, name, allow_gap_filling 
   FROM production_stages 
   WHERE name = 'UV Varnishing';
   ```

3. **Run scheduler** (dry run first):
   ```sql
   SELECT * FROM simple_scheduler_wrapper('reschedule_all');
   ```

4. **Verify gap was filled**:
   - UV Varnishing should now start within 24 hours of HP12000
   - Check `schedule_gap_fills` table for audit log

## Success Criteria

The restoration will be considered successful when:
- ✅ D427310 UV Varnishing starts Nov 10/11 (not Nov 18)
- ✅ Gap-filling moves 5-20 stages per nightly run
- ✅ No "column does not exist" errors
- ✅ Nightly cron completes in <30 seconds
- ✅ All SQL matches October 24-25 working state

## Prevention Measures (Post-Restoration)

1. **Create `validate_scheduler_schema()` function**
2. **Add versioning comments to all scheduler functions**
3. **Create rollback script** (save current state before any changes)
4. **Document any future changes** in SCHEDULER_CHANGE_LOG.md
5. **Always test in transaction** with `ROLLBACK` first

## Files Created (Phase 1 Output)

```
docs/
├── restore_oct_24_working_scheduler.sql        ✅ Functions 1-2
├── restore_oct_24_working_scheduler_part2.sql  ✅ Function 3 (Phase 1)
├── restore_oct_24_working_scheduler_part3.sql  ✅ Functions 4-5 + Phase 2
├── scheduler_schema_snapshot_oct24.md          ✅ Schema reference
└── SCHEDULER_RESTORATION_PLAN.md               ✅ This file
```

## Timeline

- **Phase 1** (Complete): 2025-11-07 - Extraction and Documentation ✅
- **Phase 2** (Pending): Schema Validation - User action required
- **Phase 3** (Pending): Controlled Restoration - After schema validation
- **Phase 4** (Pending): Forensic Analysis & Testing
- **Phase 5** (Pending): Prevention & Guardrails

---

**Next Action**: User to review extracted SQL files and run schema validation query to proceed to Phase 2.
