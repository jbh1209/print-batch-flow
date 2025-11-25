-- URGENT FIX: Drop duplicate function causing 406 errors
-- The old function signature with uuid for p_stage_filter conflicts with the new text version

DROP FUNCTION IF EXISTS get_user_accessible_jobs_with_batch_allocation(uuid, text, text, uuid);