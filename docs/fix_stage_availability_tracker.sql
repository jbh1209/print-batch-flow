-- ============================================================
-- FIX: Restore create_stage_availability_tracker (Oct 25th version)
-- ============================================================
-- Problem: Current version creates _stage_tails with composite key (stage_id, part_assignment)
-- Solution: Restore Oct 25th version with simple schema (stage_id PRIMARY KEY only)
-- This fixes "42P10: no unique constraint matching ON CONFLICT" errors
-- ============================================================

DROP FUNCTION IF EXISTS public.create_stage_availability_tracker() CASCADE;

CREATE FUNCTION public.create_stage_availability_tracker() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Create temporary table for tracking stage availability during scheduling
  DROP TABLE IF EXISTS _stage_tails;
  CREATE TEMP TABLE _stage_tails (
    stage_id uuid PRIMARY KEY,
    next_available_time timestamptz NOT NULL
  );
END;
$$;

ALTER FUNCTION public.create_stage_availability_tracker() OWNER TO postgres;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- After executing this file:
-- 1. Run a reschedule from the UI
-- 2. Check edge function logs - should see no 42P10 errors
-- 3. Verify slots are written to stage_time_slots table
-- 4. Confirm "✅ scheduler ran" success message
-- ============================================================
