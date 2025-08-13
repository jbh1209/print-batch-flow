# Production System Dependency Map

This document maps which components use which utility functions to prevent cross-contamination between Production Workflow and Weekly Scheduling systems.

## Production Workflow System

**Purpose**: Shows jobs in their current actionable stages where operators can work NOW.

**Components:**
- Production Workflow Board
- `useAccessibleJobs` hook
- Job tracking components

**Utilities:**
- `src/utils/productionWorkflowUtils.ts`
  - `getJobWorkflowStages()` - Gets current actionable stages
  - `shouldJobAppearInWorkflowStage()` - Stage filtering for workflow
  - `getJobsForWorkflowStage()` - Job filtering for workflow stages

**Data Sources:**
- `get_user_accessible_jobs` RPC
- `job_stage_instances` (filtered by status)

**Key Characteristics:**
- Shows ONE phase at a time (sequential prerequisites first, then parallel stages)
- Focuses on current work availability
- Filters by user permissions

## Weekly Scheduling System

**Purpose**: Shows complete production timeline for approved jobs with scheduling information.

**Components:**
- `StageWeeklyScheduler` component
- `useStageSchedule` hook
- Scheduling and capacity planning components

**Utilities:**
- `src/utils/schedulingUtils.ts`
  - `getJobScheduledStages()` - Gets all scheduled production stages
  - `shouldJobAppearInSchedule()` - Job filtering for scheduling (approved jobs only)
  - `getJobsForSchedulingStage()` - Job filtering for scheduling stages
  - `calculateJobProductionTime()` - Production time calculations
  - `getJobEstimatedCompletion()` - Completion date estimation
  - `groupJobsByScheduledWeek()` - Calendar organization

**Data Sources:**
- `job_stage_instances` (filtered by scheduled dates)
- `production_stages` (for capacity planning)
- `stage_capacity_profiles` (for capacity calculations)

**Key Characteristics:**
- Shows ALL scheduled stages for approved jobs
- Focuses on capacity planning and timeline management
- Filters by proof approval status
- Calendar-based organization

## Legacy Utilities (DEPRECATED)

**File**: `src/utils/parallelStageUtils.ts`
- ⚠️ **DO NOT USE** for new development
- Contains mixed logic that caused conflicts
- Will be refactored to use separated utilities

**Migration Notes:**
- Production Workflow → Use `productionWorkflowUtils.ts`
- Scheduling → Use `schedulingUtils.ts`
- Update imports when touching existing code

## Critical Rules

1. **NEVER** modify workflow utilities for scheduling purposes
2. **NEVER** modify scheduling utilities for workflow purposes
3. **ALWAYS** check this map before adding new dependencies
4. **UPDATE** this map when adding new components or utilities
5. **SEPARATE** data fetching logic between the two systems

## Testing Checklist

When making changes, verify:
- [ ] Production Workflow Board shows correct current stages
- [ ] Weekly Schedule Board shows correct scheduled timeline
- [ ] No jobs appear in wrong stages after changes
- [ ] Performance is not degraded
- [ ] Both systems work independently

## Future Considerations

- Consider separating data fetching hooks entirely
- Add TypeScript interface segregation
- Implement automated testing for dependency isolation
- Consider state management separation if systems grow larger