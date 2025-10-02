# Gap-Filling Scheduler Implementation Guide

## Overview
Two-pass scheduling algorithm that maintains FIFO as primary ordering but allows small stages (≤120 minutes) to fill earlier gaps when they can save ≥1 day, looking back up to 21 days.

## Phase 1: Database Schema Enhancement

### 1.1 Add `allow_gap_filling` Column to `production_stages`

```sql
-- Add gap-filling control column
ALTER TABLE production_stages 
ADD COLUMN allow_gap_filling BOOLEAN DEFAULT false;

-- Add helpful comment
COMMENT ON COLUMN production_stages.allow_gap_filling IS 
'When true, stages ≤120 minutes can fill earlier gaps if they save ≥1 day. Large stages (DTP, Proof, Batch, Printing) should remain false.';

-- Set default to TRUE for all stages initially
UPDATE production_stages 
SET allow_gap_filling = true;

-- Explicitly DISABLE gap-filling for large/critical stages
UPDATE production_stages 
SET allow_gap_filling = false 
WHERE name ILIKE ANY(ARRAY[
  '%DTP%',
  '%Proof%',
  '%Batch%allocation%',
  '%CD 102 5 Col%',
  '%Printing - T250%',
  '%Envelope Printing%',
  '%Printing - HP12000%',
  '%Printing - 7900%',
  '%Hunkeler%'
]);
```

### 1.2 Create `schedule_gap_fills` Logging Table

```sql
-- Track all gap-filling decisions for audit and analytics
CREATE TABLE schedule_gap_fills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What was gap-filled
  job_id UUID NOT NULL,
  stage_instance_id UUID NOT NULL REFERENCES job_stage_instances(id) ON DELETE CASCADE,
  production_stage_id UUID NOT NULL REFERENCES production_stages(id),
  
  -- Timing details
  original_scheduled_start TIMESTAMPTZ NOT NULL,
  gap_filled_start TIMESTAMPTZ NOT NULL,
  days_saved NUMERIC(10,2) NOT NULL,
  minutes_saved INTEGER NOT NULL,
  
  -- Context
  scheduler_run_type TEXT NOT NULL, -- 'reschedule_all' or 'append_jobs'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Metadata
  gap_scan_window_days INTEGER NOT NULL DEFAULT 21,
  stage_duration_minutes INTEGER NOT NULL
);

-- Index for quick lookups
CREATE INDEX idx_schedule_gap_fills_job ON schedule_gap_fills(job_id);
CREATE INDEX idx_schedule_gap_fills_stage_instance ON schedule_gap_fills(stage_instance_id);
CREATE INDEX idx_schedule_gap_fills_created_at ON schedule_gap_fills(created_at DESC);

-- RLS Policy
ALTER TABLE schedule_gap_fills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view gap fill logs"
  ON schedule_gap_fills FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE schedule_gap_fills IS 
'Audit log of all gap-filling scheduling decisions showing original vs optimized times';
```

---

## Phase 2: Gap Detection Function

### 2.1 Create `find_available_gaps` Function

```sql
CREATE OR REPLACE FUNCTION public.find_available_gaps(
  p_stage_id UUID,
  p_duration_minutes INTEGER,
  p_fifo_start_time TIMESTAMPTZ,
  p_lookback_days INTEGER DEFAULT 21
)
RETURNS TABLE(
  gap_start TIMESTAMPTZ,
  gap_end TIMESTAMPTZ,
  gap_capacity_minutes INTEGER,
  days_earlier NUMERIC
) 
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_scan_start TIMESTAMPTZ;
  v_day_cursor DATE;
  v_shift_start TIMESTAMPTZ;
  v_shift_end TIMESTAMPTZ;
  v_occupied_slots RECORD;
  v_available_start TIMESTAMPTZ;
  v_available_end TIMESTAMPTZ;
  v_available_minutes INTEGER;
BEGIN
  -- Calculate scan window (look back from FIFO start time)
  v_scan_start := p_fifo_start_time - (p_lookback_days || ' days')::INTERVAL;
  
  RAISE NOTICE 'Scanning for gaps: stage=%, duration=% mins, FIFO start=%, scanning back to %',
    p_stage_id, p_duration_minutes, p_fifo_start_time, v_scan_start;
  
  -- Loop through each working day in the scan window
  FOR v_day_cursor IN 
    SELECT d::DATE 
    FROM generate_series(v_scan_start::DATE, p_fifo_start_time::DATE, '1 day'::INTERVAL) d
    WHERE EXTRACT(DOW FROM d) NOT IN (0, 6) -- Skip weekends
      AND NOT EXISTS (
        SELECT 1 FROM public_holidays 
        WHERE date = d::DATE 
          AND COALESCE(is_active, true) = true
      )
    ORDER BY d ASC
  LOOP
    -- Get working shift boundaries for this day (from factory shifts)
    SELECT 
      v_day_cursor + start_time::TIME AS shift_start,
      v_day_cursor + end_time::TIME AS shift_end
    INTO v_shift_start, v_shift_end
    FROM factory_shifts
    WHERE is_active = true
    ORDER BY start_time ASC
    LIMIT 1;
    
    -- Skip if no shift defined
    CONTINUE WHEN v_shift_start IS NULL;
    
    -- Find gaps in this day's schedule for this stage
    v_available_start := v_shift_start;
    
    FOR v_occupied_slots IN
      SELECT 
        slot_start_time,
        slot_end_time
      FROM stage_time_slots
      WHERE production_stage_id = p_stage_id
        AND date = v_day_cursor
        AND COALESCE(is_completed, false) = false
      ORDER BY slot_start_time ASC
    LOOP
      -- Calculate gap before this occupied slot
      v_available_end := v_occupied_slots.slot_start_time;
      v_available_minutes := EXTRACT(EPOCH FROM (v_available_end - v_available_start)) / 60;
      
      -- If gap is big enough, return it
      IF v_available_minutes >= p_duration_minutes 
         AND v_available_start < p_fifo_start_time THEN
        RETURN QUERY SELECT
          v_available_start,
          v_available_start + (p_duration_minutes || ' minutes')::INTERVAL,
          v_available_minutes::INTEGER,
          EXTRACT(EPOCH FROM (p_fifo_start_time - v_available_start)) / 86400.0;
      END IF;
      
      -- Move cursor to end of occupied slot
      v_available_start := v_occupied_slots.slot_end_time;
    END LOOP;
    
    -- Check final gap after last occupied slot until shift end
    v_available_minutes := EXTRACT(EPOCH FROM (v_shift_end - v_available_start)) / 60;
    IF v_available_minutes >= p_duration_minutes 
       AND v_available_start < p_fifo_start_time THEN
      RETURN QUERY SELECT
        v_available_start,
        v_available_start + (p_duration_minutes || ' minutes')::INTERVAL,
        v_available_minutes::INTEGER,
        EXTRACT(EPOCH FROM (p_fifo_start_time - v_available_start)) / 86400.0;
    END IF;
  END LOOP;
  
  RETURN;
END;
$function$;

COMMENT ON FUNCTION public.find_available_gaps IS 
'Scans backward from FIFO start time to find available gaps in a stage schedule. Returns gaps large enough for the requested duration that would save ≥1 day.';
```

---

## Phase 3: Enhanced Scheduling Functions

### 3.1 Modify `scheduler_reschedule_all_parallel_aware`

Add gap-filling optimization pass after main FIFO scheduling:

```sql
-- Add this section AFTER the main FIFO scheduling loop completes
-- (after "END LOOP;" for r_job processing)

-- ============================================================================
-- PHASE 2: GAP-FILLING OPTIMIZATION PASS
-- ============================================================================
RAISE NOTICE '========================================';
RAISE NOTICE 'PHASE 2: GAP-FILLING OPTIMIZATION';
RAISE NOTICE '========================================';

-- Find eligible stages for gap-filling (≤120 mins, gap-filling enabled)
FOR r_stage IN
  SELECT 
    jsi.id as stage_instance_id,
    jsi.job_id,
    jsi.production_stage_id,
    jsi.scheduled_start_at as fifo_start,
    jsi.scheduled_end_at as fifo_end,
    jsi.scheduled_minutes,
    ps.name as stage_name,
    ps.allow_gap_filling,
    pj.wo_no
  FROM job_stage_instances jsi
  JOIN production_stages ps ON ps.id = jsi.production_stage_id
  JOIN production_jobs pj ON pj.id = jsi.job_id
  WHERE jsi.schedule_status = 'scheduled'
    AND jsi.scheduled_start_at IS NOT NULL
    AND jsi.scheduled_minutes IS NOT NULL
    AND jsi.scheduled_minutes <= 120  -- Only small stages
    AND ps.allow_gap_filling = true   -- Stage allows gap-filling
    AND COALESCE(jsi.status, '') NOT IN ('completed', 'active')
  ORDER BY jsi.scheduled_start_at ASC
LOOP
  DECLARE
    v_best_gap RECORD;
    v_gap_saves_days NUMERIC;
    v_old_slots RECORD;
  BEGIN
    -- Find best available gap for this stage
    SELECT * INTO v_best_gap
    FROM public.find_available_gaps(
      r_stage.production_stage_id,
      r_stage.scheduled_minutes,
      r_stage.fifo_start,
      21  -- 21 day lookback window
    )
    WHERE days_earlier >= 1.0  -- Must save at least 1 day
    ORDER BY gap_start ASC  -- Prefer earliest gap
    LIMIT 1;
    
    -- Skip if no suitable gap found
    CONTINUE WHEN v_best_gap IS NULL;
    
    v_gap_saves_days := v_best_gap.days_earlier;
    
    RAISE NOTICE '🔀 GAP-FILL OPPORTUNITY: Job % Stage % (%): FIFO=%, Gap=%, Saves %.2f days',
      r_stage.wo_no,
      r_stage.stage_name,
      r_stage.stage_instance_id,
      r_stage.fifo_start,
      v_best_gap.gap_start,
      v_gap_saves_days;
    
    -- Delete old FIFO time slots
    DELETE FROM stage_time_slots
    WHERE stage_instance_id = r_stage.stage_instance_id
      AND COALESCE(is_completed, false) = false;
    
    -- Create new gap-filled time slot
    INSERT INTO stage_time_slots(
      production_stage_id,
      date,
      slot_start_time,
      slot_end_time,
      duration_minutes,
      job_id,
      job_table_name,
      stage_instance_id,
      is_completed
    )
    VALUES (
      r_stage.production_stage_id,
      v_best_gap.gap_start::DATE,
      v_best_gap.gap_start,
      v_best_gap.gap_end,
      r_stage.scheduled_minutes,
      r_stage.job_id,
      'production_jobs',
      r_stage.stage_instance_id,
      false
    );
    
    -- Update job_stage_instances with new times
    UPDATE job_stage_instances
    SET 
      scheduled_start_at = v_best_gap.gap_start,
      scheduled_end_at = v_best_gap.gap_end,
      updated_at = now()
    WHERE id = r_stage.stage_instance_id;
    
    -- Log the gap-filling decision
    INSERT INTO schedule_gap_fills(
      job_id,
      stage_instance_id,
      production_stage_id,
      original_scheduled_start,
      gap_filled_start,
      days_saved,
      minutes_saved,
      scheduler_run_type,
      gap_scan_window_days,
      stage_duration_minutes
    )
    VALUES (
      r_stage.job_id,
      r_stage.stage_instance_id,
      r_stage.production_stage_id,
      r_stage.fifo_start,
      v_best_gap.gap_start,
      v_gap_saves_days,
      EXTRACT(EPOCH FROM (r_stage.fifo_start - v_best_gap.gap_start)) / 60,
      'reschedule_all',
      21,
      r_stage.scheduled_minutes
    );
    
    RAISE NOTICE '✅ Gap-filled stage % for job % - saved %.2f days',
      r_stage.stage_name, r_stage.wo_no, v_gap_saves_days;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ Gap-filling failed for stage %: %', r_stage.stage_instance_id, SQLERRM;
    -- Continue with next stage on error
  END;
END LOOP;

RAISE NOTICE 'Gap-filling optimization pass completed';
```

### 3.2 Modify `scheduler_append_jobs`

Add similar gap-filling logic after FIFO scheduling:

```sql
-- Add this section AFTER the main FIFO loop (after "END LOOP;" for r_stage)

-- ============================================================================
-- GAP-FILLING OPTIMIZATION FOR APPENDED JOBS
-- ============================================================================
RAISE NOTICE '========================================';
RAISE NOTICE 'GAP-FILLING OPTIMIZATION (APPEND MODE)';
RAISE NOTICE '========================================';

FOR r_stage IN
  SELECT 
    jsi.id as stage_instance_id,
    jsi.job_id,
    jsi.production_stage_id,
    jsi.scheduled_start_at as fifo_start,
    jsi.scheduled_end_at as fifo_end,
    jsi.scheduled_minutes,
    ps.name as stage_name,
    ps.allow_gap_filling,
    pj.wo_no
  FROM job_stage_instances jsi
  JOIN production_stages ps ON ps.id = jsi.production_stage_id
  JOIN production_jobs pj ON pj.id = jsi.job_id
  WHERE jsi.job_id = ANY(p_job_ids)
    AND jsi.schedule_status = 'scheduled'
    AND jsi.scheduled_start_at IS NOT NULL
    AND jsi.scheduled_minutes IS NOT NULL
    AND jsi.scheduled_minutes <= 120
    AND ps.allow_gap_filling = true
  ORDER BY jsi.scheduled_start_at ASC
LOOP
  DECLARE
    v_best_gap RECORD;
    v_gap_saves_days NUMERIC;
  BEGIN
    SELECT * INTO v_best_gap
    FROM public.find_available_gaps(
      r_stage.production_stage_id,
      r_stage.scheduled_minutes,
      r_stage.fifo_start,
      21
    )
    WHERE days_earlier >= 1.0
    ORDER BY gap_start ASC
    LIMIT 1;
    
    CONTINUE WHEN v_best_gap IS NULL;
    
    v_gap_saves_days := v_best_gap.days_earlier;
    
    RAISE NOTICE '🔀 APPEND GAP-FILL: Job % Stage %: saves %.2f days',
      r_stage.wo_no, r_stage.stage_name, v_gap_saves_days;
    
    -- Delete old slots and create new gap-filled slot (same as above)
    DELETE FROM stage_time_slots
    WHERE stage_instance_id = r_stage.stage_instance_id
      AND COALESCE(is_completed, false) = false;
    
    INSERT INTO stage_time_slots(
      production_stage_id, date, slot_start_time, slot_end_time,
      duration_minutes, job_id, job_table_name, stage_instance_id, is_completed
    )
    VALUES (
      r_stage.production_stage_id,
      v_best_gap.gap_start::DATE,
      v_best_gap.gap_start,
      v_best_gap.gap_end,
      r_stage.scheduled_minutes,
      r_stage.job_id,
      'production_jobs',
      r_stage.stage_instance_id,
      false
    );
    
    UPDATE job_stage_instances
    SET scheduled_start_at = v_best_gap.gap_start,
        scheduled_end_at = v_best_gap.gap_end,
        updated_at = now()
    WHERE id = r_stage.stage_instance_id;
    
    INSERT INTO schedule_gap_fills(
      job_id, stage_instance_id, production_stage_id,
      original_scheduled_start, gap_filled_start,
      days_saved, minutes_saved, scheduler_run_type,
      gap_scan_window_days, stage_duration_minutes
    )
    VALUES (
      r_stage.job_id, r_stage.stage_instance_id, r_stage.production_stage_id,
      r_stage.fifo_start, v_best_gap.gap_start,
      v_gap_saves_days,
      EXTRACT(EPOCH FROM (r_stage.fifo_start - v_best_gap.gap_start)) / 60,
      'append_jobs',
      21,
      r_stage.scheduled_minutes
    );
    
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '❌ Gap-filling failed for appended stage %: %', 
      r_stage.stage_instance_id, SQLERRM;
  END;
END LOOP;
```

---

## Phase 4: Admin UI Controls

### 4.1 Production Stages Table - Add Gap-Filling Toggle

Location: Admin → Production Stages management page

Add column to stages table:

```typescript
{
  accessorKey: "allow_gap_filling",
  header: "Gap Filling",
  cell: ({ row }) => {
    const stage = row.original;
    return (
      <Switch
        checked={stage.allow_gap_filling}
        onCheckedChange={async (checked) => {
          await supabase
            .from('production_stages')
            .update({ allow_gap_filling: checked })
            .eq('id', stage.id);
          toast.success(`Gap-filling ${checked ? 'enabled' : 'disabled'} for ${stage.name}`);
        }}
      />
    );
  }
}
```

Add info tooltip explaining:
- "Allow stages ≤120 minutes to fill earlier schedule gaps"
- "Saves time by using idle capacity"
- "Disabled by default for large/critical stages"

### 4.2 Schedule Board - Visual Indicators

Add badge to gap-filled stages in schedule display:

```typescript
// In ScheduleBoard component, when rendering stage cards:
const isGapFilled = await checkIfGapFilled(stageInstanceId);

{isGapFilled && (
  <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-300">
    <Repeat className="w-3 h-3 mr-1" />
    Gap-Filled
  </Badge>
)}
```

Add tooltip showing gap-filling details:

```typescript
<Tooltip>
  <TooltipTrigger>
    <Info className="w-4 h-4 text-amber-600" />
  </TooltipTrigger>
  <TooltipContent>
    <div className="space-y-1 text-xs">
      <p><strong>Gap-Filled Schedule</strong></p>
      <p>Original: {formatDateTime(originalStart)}</p>
      <p>Optimized: {formatDateTime(gapFilledStart)}</p>
      <p className="text-green-600 font-medium">
        Saved {daysSaved} days
      </p>
    </div>
  </TooltipContent>
</Tooltip>
```

### 4.3 Gap-Filling Statistics Panel

Add new component: `src/components/schedule/GapFillingStats.tsx`

```typescript
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Repeat, TrendingDown, Award } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function GapFillingStats() {
  const { data: stats } = useQuery({
    queryKey: ['gap-filling-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('schedule_gap_fills')
        .select('*')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      
      const totalStages = data?.length || 0;
      const totalDaysSaved = data?.reduce((sum, g) => sum + g.days_saved, 0) || 0;
      const mostImproved = data?.sort((a, b) => b.days_saved - a.days_saved)[0];
      
      return { totalStages, totalDaysSaved, mostImproved };
    }
  });

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Gap-Filled Stages</CardTitle>
          <Repeat className="w-4 h-4 text-amber-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.totalStages || 0}</div>
          <p className="text-xs text-muted-foreground">Last 30 days</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Days Saved</CardTitle>
          <TrendingDown className="w-4 h-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.totalDaysSaved.toFixed(1) || 0}</div>
          <p className="text-xs text-muted-foreground">Total time savings</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Best Optimization</CardTitle>
          <Award className="w-4 h-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats?.mostImproved?.days_saved.toFixed(1) || 0} days
          </div>
          <p className="text-xs text-muted-foreground">Single stage improvement</p>
        </CardContent>
      </Card>
    </div>
  );
}
```

Add to Schedule Board header:

```typescript
import { GapFillingStats } from "@/components/schedule/GapFillingStats";

// In ScheduleBoardPage.tsx
<div className="space-y-4">
  <GapFillingStats />
  <ScheduleBoard ... />
</div>
```

---

## Testing Checklist

### Unit Tests
- [ ] `find_available_gaps` returns correct gaps for various scenarios
- [ ] Gap-filling only triggers for stages ≤120 minutes
- [ ] Gap-filling only triggers when savings ≥1 day
- [ ] Large stages (DTP, Printing, etc.) are excluded
- [ ] Gaps respect working hours and holidays

### Integration Tests
- [ ] `scheduler_reschedule_all_parallel_aware` completes both passes
- [ ] `scheduler_append_jobs` applies gap-filling correctly
- [ ] `schedule_gap_fills` table logs all decisions
- [ ] Gap-filled stages show amber badge in UI
- [ ] Statistics panel displays accurate counts

### Real-World Test Cases
- [ ] Job D426225 (14-26 min stages) moves from Oct 22 → Oct 2-3
- [ ] Large printing jobs stay in FIFO order (not gap-filled)
- [ ] Multiple small jobs compete for same gap (earliest wins)
- [ ] Gap-filling respects dependency groups and part assignments
- [ ] Turning off gap-filling for a stage reverts to pure FIFO

---

## Rollout Plan

1. **Week 1: Schema & Functions**
   - Deploy Phase 1 & 2 (schema + gap detection)
   - Verify functions work in isolation
   - No behavioral changes yet

2. **Week 2: Scheduler Integration**
   - Deploy Phase 3 (enhanced schedulers)
   - Monitor logs for gap-filling decisions
   - Keep all stages `allow_gap_filling = false` initially

3. **Week 3: Pilot Testing**
   - Enable gap-filling for 3-5 small stages (Laminating, Trimming, etc.)
   - Monitor for 1 week
   - Collect feedback from operators

4. **Week 4: Full Rollout**
   - Enable gap-filling for all eligible stages
   - Deploy Phase 4 (UI controls)
   - Train users on new badges/indicators

---

## Configuration Reference

### Gap-Filling Parameters

| Parameter | Value | Location | Purpose |
|-----------|-------|----------|---------|
| `max_stage_duration` | 120 minutes | SQL functions | Only stages ≤120 mins eligible |
| `min_days_saved` | 1.0 days | SQL functions | Must save ≥1 day to gap-fill |
| `lookback_window` | 21 days | SQL functions | How far back to scan for gaps |
| `allow_gap_filling` | per-stage boolean | `production_stages` table | Stage-level control |

### Disabled Stages (No Gap-Filling)

These stages should have `allow_gap_filling = false`:
- DTP
- Proof  
- Batch allocation
- CD 102 5 Col
- Printing - T250
- Envelope Printing
- Printing - HP12000
- Printing - 7900
- Hunkeler

---

## Support & Monitoring

### Key Queries for Monitoring

**Check gap-filling activity:**
```sql
SELECT 
  COUNT(*) as total_gap_fills,
  SUM(days_saved) as total_days_saved,
  AVG(days_saved) as avg_days_saved,
  scheduler_run_type
FROM schedule_gap_fills
WHERE created_at >= now() - interval '7 days'
GROUP BY scheduler_run_type;
```

**Find most optimized jobs:**
```sql
SELECT 
  pj.wo_no,
  ps.name as stage_name,
  sgf.days_saved,
  sgf.original_scheduled_start,
  sgf.gap_filled_start
FROM schedule_gap_fills sgf
JOIN production_jobs pj ON pj.id = sgf.job_id
JOIN production_stages ps ON ps.id = sgf.production_stage_id
WHERE sgf.created_at >= now() - interval '30 days'
ORDER BY sgf.days_saved DESC
LIMIT 20;
```

**Identify stages that could benefit from gap-filling:**
```sql
SELECT 
  ps.name,
  ps.allow_gap_filling,
  COUNT(jsi.id) as eligible_stages,
  AVG(jsi.scheduled_minutes) as avg_duration
FROM production_stages ps
JOIN job_stage_instances jsi ON jsi.production_stage_id = ps.id
WHERE jsi.scheduled_minutes <= 120
  AND jsi.scheduled_start_at IS NOT NULL
GROUP BY ps.id, ps.name, ps.allow_gap_filling
ORDER BY eligible_stages DESC;
```

---

## Expected Impact

### For Job D426225:
- **Before:** Printing Oct 2 → Laminating Oct 3 → Trimming Oct 22
- **After:** Printing Oct 2 → Laminating Oct 2 → Trimming Oct 2-3
- **Savings:** ~20 days

### System-Wide (Estimated):
- 15-25% reduction in lead time for small jobs
- 10-15% improvement in capacity utilization
- Maintained FIFO fairness for large jobs
- Better customer satisfaction for urgent small orders

---

## End of Implementation Guide
