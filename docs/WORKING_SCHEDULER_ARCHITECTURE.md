# Working Scheduler Architecture Documentation

**CRITICAL: This documents the WORKING configuration as of commit ecce872**
**DO NOT MODIFY WITHOUT EXTREME CAUTION**

## Overview

The current working scheduler uses a **Resource-Fill Optimization** strategy implemented entirely in SQL functions. This approach has proven stable and performant.

## System Entry Points

### 1. UI Entry Point
- **File**: `src/pages/ScheduleBoardPage.tsx`
- **Function**: `handleReschedule()` 
- **Action**: Calls `supabase.rpc('simple_scheduler_wrapper', { p_mode: 'reschedule_all' })`

### 2. Database Entry Point
- **Function**: `simple_scheduler_wrapper(p_mode text)`
- **Purpose**: Main coordinator function
- **Key Behavior**: Routes to `scheduler_resource_fill_optimized()` for all modes

## Core Scheduling Algorithm

### Primary Function: `scheduler_resource_fill_optimized()`

**Strategy**: Resource-availability-first scheduling
- Maintains resource availability tracking
- Uses temporary table `_stage_tails` for state management
- Processes jobs in FIFO order by `proof_approved_at`
- Places duration using `place_duration_sql()`

**Key Features**:
1. **Single SQL Transaction**: All scheduling happens atomically
2. **Resource Tracking**: Maintains `_stage_tails` table for stage availability
3. **Working Day Awareness**: Uses `is_working_day()` and `next_working_start()`
4. **Proof Approval Filtering**: Only schedules approved jobs

## Critical Dependencies

### Time Calculation Functions
- `next_working_start(timestamptz)`: Finds next valid working start time
- `is_working_day(date)`: Checks if date is a working day
- `shift_window_enhanced(date)`: Gets shift start/end times
- `place_duration_sql(start_time, minutes)`: Places duration across working hours
- `jsi_minutes(scheduled, estimated)`: Gets effective duration minutes

### Data Tables
- `job_stage_instances`: Core scheduling data
- `stage_time_slots`: Time slot allocations  
- `shift_schedules`: Working hours definition
- `public_holidays`: Non-working days
- `production_stages`: Stage definitions

## Working Data Flow

1. **Input**: Jobs with `proof_approved_at` timestamps
2. **Filter**: Only `pending` status stages from approved jobs
3. **Sort**: FIFO order by proof approval time
4. **Resource Check**: Query `_stage_tails` for stage availability
5. **Time Placement**: Use `place_duration_sql()` to find slots
6. **Slot Creation**: Insert into `stage_time_slots`
7. **Instance Update**: Set `scheduled_start_at`, `scheduled_end_at`
8. **Resource Update**: Update `_stage_tails` with new availability

## Success Metrics (Current Working State)

- **Total Scheduled Stages**: 323
- **Function Call**: `simple_scheduler_wrapper('reschedule_all')`
- **Response Format**: `{scheduled_count: N, wrote_slots: N, success: true}`
- **Execution Time**: < 30 seconds (no statement timeout)

## CRITICAL: What NOT to Change

1. **Never modify** `scheduler_resource_fill_optimized()` without full system backup
2. **Never change** the `simple_scheduler_wrapper` routing logic
3. **Never alter** the `_stage_tails` temporary table structure
4. **Never modify** `place_duration_sql()` time slot logic
5. **Never change** the FIFO ordering by `proof_approved_at`

## Previous Failed Approaches (DO NOT RETRY)

1. **Edge Function Chunking**: Statement timeouts, complex state management
2. **Sequential Processing**: Too slow, resource conflicts
3. **Parallel Processing**: Race conditions, data inconsistency
4. **Client-side Scheduling**: Network overhead, state sync issues

## Maintenance Guidelines

- **Database Backups**: Always backup before scheduler changes
- **Function Testing**: Test in isolated environment first
- **Performance Monitoring**: Watch for statement timeout warnings
- **Data Validation**: Verify scheduled counts after changes

---
**Last Updated**: Post-restoration from commit ecce872
**Status**: WORKING - DO NOT MODIFY WITHOUT EXTREME CAUTION