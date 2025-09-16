# Scheduler Data Flow Documentation

**WORKING SYSTEM - DO NOT MODIFY**

## Complete Data Flow Diagram

```
UI Trigger (ScheduleBoardPage)
    ↓
handleReschedule() 
    ↓
supabase.rpc('simple_scheduler_wrapper', {p_mode: 'reschedule_all'})
    ↓
Database: simple_scheduler_wrapper(p_mode)
    ↓
scheduler_resource_fill_optimized()
    ↓
1. Clear existing schedule data
2. Create _stage_tails temp table
3. Initialize stage availability
4. Fetch approved jobs (FIFO by proof_approved_at)
5. For each job:
   ├── Get pending stages (ordered by stage_order)
   ├── For each stage:
   │   ├── Check _stage_tails for resource availability
   │   ├── Calculate earliest start time
   │   ├── Call place_duration_sql(start_time, duration)
   │   ├── Insert time slots into stage_time_slots
   │   ├── Update job_stage_instances with schedule times
   │   └── Update _stage_tails with new availability
   └── Continue to next job
    ↓
Return scheduling results
    ↓
UI displays updated schedule
```

## Key Data Transformations

### 1. Job Selection & Filtering
```sql
INPUT: All production_jobs
FILTER: proof_approved_at IS NOT NULL
SORT: proof_approved_at ASC (FIFO)
OUTPUT: Approved jobs in chronological order
```

### 2. Stage Selection & Filtering  
```sql
INPUT: job_stage_instances for approved jobs
FILTER: status = 'pending' AND stage NOT IN (dtp, proof, batch_allocation)
SORT: stage_order ASC
OUTPUT: Schedulable stages in workflow order
```

### 3. Resource Availability Tracking
```sql
INITIALIZE: _stage_tails with base availability times
UPDATE: After each stage placement
QUERY: next_available_time for each stage
MAINTAIN: Current availability per production stage
```

### 4. Time Slot Placement
```sql
INPUT: (start_time, duration_minutes)
PROCESS: place_duration_sql() - handles shifts, breaks, boundaries
OUTPUT: Array of time slot objects with precise start/end times
```

### 5. Schedule Updates
```sql
INSERT: stage_time_slots (time allocations)
UPDATE: job_stage_instances (scheduled_start_at, scheduled_end_at)  
UPDATE: _stage_tails (next_available_time)
```

## Critical State Management

### Temporary State: `_stage_tails`
- **Purpose**: Track when each production stage becomes available
- **Lifecycle**: Created per scheduling run, destroyed after completion
- **Updates**: After each stage placement
- **Query Pattern**: `SELECT next_available_time FROM _stage_tails WHERE stage_id = ?`

### Persistent State: `stage_time_slots`
- **Purpose**: Store allocated time slots
- **Structure**: One record per time slice (can span multiple slots)
- **Relationships**: Links job → stage → time allocation
- **Cleanup**: Old allocations cleared before new scheduling

### Schedule State: `job_stage_instances`
- **Purpose**: Store calculated schedule times
- **Fields**: `scheduled_start_at`, `scheduled_end_at`, `scheduled_minutes`
- **Status**: Updated to 'scheduled' after successful placement
- **Dependencies**: Used by UI to display schedule

## Error Handling & Rollback

### Transaction Boundaries
- **Level**: Single SQL transaction for entire scheduling operation
- **Rollback**: Any failure rolls back all changes
- **Atomicity**: Either all jobs scheduled or none

### Failure Points
1. **Resource conflicts**: Stage availability calculation errors
2. **Time placement**: Unable to fit duration in working hours  
3. **Data integrity**: Foreign key violations, constraint failures
4. **Performance**: Statement timeout (avoided by single SQL transaction)

## Performance Characteristics

### Working Metrics (Current State)
- **Total stages processed**: 323
- **Execution time**: < 30 seconds
- **Memory usage**: Temp table + result sets
- **Database load**: Single transaction, minimal locking

### Scalability Factors
- **Jobs**: Linear growth with job count
- **Time horizon**: Limited by working day generation
- **Stages per job**: Linear impact on processing time
- **Resource contention**: Minimal due to sequential processing

---
**PRESERVE THIS DATA FLOW - IT WORKS**