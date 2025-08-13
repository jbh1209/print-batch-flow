# Production Scheduler Analysis - Critical Issues

## Application Overview

This is a React + TypeScript production management system for a printing company using:
- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Key Libraries**: date-fns, date-fns-tz for timezone handling, React Query for data fetching

## Business Context

The system manages print jobs through production stages (DTP → Proof → Print → Finishing → etc.). Jobs must be scheduled within:
- **Business Hours**: 8:00 AM - 5:30 PM SAST (South African Standard Time)
- **Working Days**: Monday-Friday only
- **Stage Capacity**: Each stage has daily hour limits

## Critical Scheduler Issues

### Issue 1: UI Display Bug - Wrong Times Shown
**Problem**: Scheduler shows times like "18:17" instead of "06:00" for jobs correctly scheduled at 6 AM SAST in database.

**Root Cause**: Double timezone conversion in display components
- Database stores UTC correctly
- Backend converts UTC → SAST correctly  
- UI components convert SAST → SAST again, adding +2 hours

**Evidence**: User screenshots show times 2 hours ahead of actual scheduled times

### Issue 2: "10 Days Later" Scheduling Bug
**Problem**: Jobs that should be scheduled consecutively are spread over weeks/months
- Job 1: Friday
- Job 2: 10+ days later (should be Monday)

**Root Cause**: Broken queue management logic forces sequential scheduling instead of parallel capacity utilization

## Technical Architecture

### Timezone Handling System
**File**: `src/utils/timezone.ts` (262 lines)
- Centralizes all SAST timezone operations
- Functions: `toSAST()`, `fromSAST()`, `getCurrentSAST()`, `formatSAST()`
- **CRITICAL**: All UI should use these functions, NOT raw date-fns-tz

### Scheduler Components
1. **StageWeeklyScheduler.tsx** - Main UI component showing weekly job schedule
2. **AdvancedScheduleView.tsx** - Detailed job timeline analysis
3. **WorkloadImpactPreview.tsx** - Capacity impact display

### Database Functions (Supabase)
- `get_stage_queue_end_time()` - **BROKEN**: Forces sequential job scheduling
- `calculate_job_start_time()` - Calculates earliest job start based on queue
- `advance_job_stage_with_groups()` - Handles job workflow progression

### Business Logic Engine
**File**: `src/utils/scheduling/businessLogicEngine.ts`
- `calculateNextAvailableSlot()` - Core scheduling algorithm
- `scheduleMultipleJobs()` - Batch job scheduling
- `getWorkingHoursRemainingInDay()` - Daily capacity calculations

## Specific Technical Problems

### 1. Double Timezone Conversion in UI
```typescript
// WRONG (current implementation):
const displayTime = formatSAST(toSAST(dbTimeFromSAST))
// Results in: 08:00 SAST → 10:00 displayed

// CORRECT:
const displayTime = formatSAST(dbTimeFromSAST) 
// Results in: 08:00 SAST → 08:00 displayed
```

### 2. Sequential Queue Logic Instead of Parallel Capacity
**Current Broken Logic**:
- Job A scheduled at 08:00 Friday
- Job B forced to wait until Job A "queue end time"
- Result: Job B scheduled days/weeks later

**Required Logic**:
- Check daily capacity: Stage X has 8 hours/day capacity
- Job A (2 hours) + Job B (3 hours) = 5 hours total
- Both jobs can run same day: A at 08:00, B at 10:00

### 3. Test Suite Inadequacy
**File**: `src/utils/scheduling/masterTestRunner.ts`
- Tests individual functions in isolation
- **MISSING**: End-to-end integration testing
- **MISSING**: UI display validation
- **MISSING**: Multi-job scheduling scenarios

## Data Flow Issues

### Expected Flow:
1. User schedules job → Business logic calculates SAST time
2. Store UTC in database: `sastToDbTime(sastDate)`
3. Retrieve for display: `dbTimeToSAST(utcString)`
4. Display in UI: `formatSAST(sastDate)`

### Actual Broken Flow:
1. ✅ Job scheduled correctly in UTC
2. ✅ Backend retrieval converts to SAST correctly
3. ❌ UI components apply additional SAST conversion
4. ❌ Display shows wrong times

## Database Schema Relevant Tables

```sql
-- Jobs with scheduled times
job_stage_instances:
  - scheduled_start_at (timestamptz UTC)
  - scheduled_end_at (timestamptz UTC)
  - production_stage_id
  - job_id

-- Stage capacity limits  
stage_capacity_profiles:
  - production_stage_id
  - daily_capacity_hours (integer)

-- Broken queue tracking
stage_workload_tracking:
  - queue_ends_at (forces sequential scheduling)
```

## User Experience Impact
- **Operator Confusion**: Can't trust displayed times
- **Production Delays**: Jobs spread over weeks instead of days
- **Capacity Waste**: Stages sitting idle while jobs queue unnecessarily
- **Customer Impact**: Delivery promises based on wrong schedule data

## Previous Failed Attempts
1. **UI Timezone Fix**: Removed double conversion in StageWeeklyScheduler.tsx
2. **Database Migration**: Attempted to replace queue functions with parallel capacity logic
3. **Test Validation**: All tests pass but test real-world scenarios

## Questions for Analysis

1. **Is the core issue architectural?** Should scheduling be moved from database functions to application logic?

2. **Are there hidden dependencies?** What other components might be causing the "10 days later" bug?

3. **Is the timezone utility being misused?** Are components bypassing the centralized timezone functions?

4. **Database vs Application Logic?** Should complex scheduling logic be in PostgreSQL functions or TypeScript business logic?

5. **What's the minimal fix?** Can this be solved with targeted fixes or does it need architectural changes?

## Request for Analysis

Please analyze this system and identify:
1. **Root causes** of both the display bug and scheduling logic bug
2. **Minimal viable fixes** that don't require complete rewrites  
3. **Testing strategy** to prevent regression
4. **Architectural recommendations** for reliable scheduling

The current developer has attempted UI fixes and database migrations but the core issues persist. What are they missing?