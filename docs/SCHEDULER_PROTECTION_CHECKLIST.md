# Scheduler Protection Checklist

**BEFORE ANY SCHEDULER CHANGES - FOLLOW THIS CHECKLIST**

## Pre-Change Requirements

### 1. System Backup ✅
- [ ] Database backup created
- [ ] Lovable project backup/commit
- [ ] Document current working state metrics
- [ ] Record current function signatures

### 2. Working State Verification ✅
- [ ] Current scheduler runs without errors
- [ ] Verify scheduling results are logical
- [ ] Check stage time slot allocations
- [ ] Confirm UI displays correctly

### 3. Change Impact Assessment ✅
- [ ] Identify all affected functions
- [ ] Map dependency chains
- [ ] Assess risk level (LOW/MEDIUM/HIGH)
- [ ] Plan rollback strategy

## Protected Functions (NEVER MODIFY WITHOUT BACKUP)

### CRITICAL - Full System Backup Required
- `simple_scheduler_wrapper()`
- `scheduler_resource_fill_optimized()`
- `place_duration_sql()`

### HIGH RISK - Database Backup Required
- `next_working_start()`
- `is_working_day()`
- `shift_window_enhanced()`
- `jsi_minutes()`

### MEDIUM RISK - Commit Backup Required
- Display/UI functions
- Data formatting functions
- Non-scheduling business logic

## Protected Database Objects

### Tables - Never Alter Structure
- `job_stage_instances` (core scheduling data)
- `stage_time_slots` (time allocations)
- `shift_schedules` (working hours)
- `public_holidays` (non-working days)

### Indexes - Never Drop
- Proof approval time indexes
- Stage order indexes
- Date-based indexes for time queries

### Constraints - Never Remove
- Foreign key relationships
- Check constraints on time ranges
- NOT NULL constraints on critical fields

## Testing Protocol

### 1. Isolated Testing Environment
- [ ] Test on copy of production data
- [ ] Verify test results match production patterns
- [ ] Check performance characteristics
- [ ] Validate edge cases

### 2. Staging Verification
- [ ] Deploy to staging environment
- [ ] Run with real data subset
- [ ] Verify UI integration
- [ ] Check error handling

### 3. Production Deployment
- [ ] Schedule maintenance window
- [ ] Have rollback plan ready
- [ ] Monitor performance metrics
- [ ] Verify scheduling results

## Rollback Procedures

### Function Rollback
```sql
-- Restore function from backup
DROP FUNCTION IF EXISTS function_name();
-- Execute backup SQL to restore
```

### Data Rollback
```sql
-- Clear corrupted schedule data
DELETE FROM stage_time_slots WHERE created_at > 'rollback_timestamp';
UPDATE job_stage_instances SET 
  scheduled_start_at = NULL,
  scheduled_end_at = NULL,
  scheduled_minutes = NULL
WHERE updated_at > 'rollback_timestamp';
```

### Full System Rollback
- Restore database from backup
- Revert Lovable to previous commit
- Verify working state restored

## Warning Signs - STOP AND ROLLBACK

### Performance Issues
- Execution time > 60 seconds
- Statement timeout errors
- Database connection pool exhaustion
- High CPU usage during scheduling

### Data Issues
- Negative time allocations
- Overlapping time slots for same resource
- Missing scheduled times for approved jobs
- Incorrect stage ordering

### Logical Issues
- Jobs scheduled before approval time
- Stages scheduled outside working hours
- Resource conflicts not detected
- Invalid time slot boundaries

## Post-Change Verification

### 1. Functional Testing
- [ ] Run full schedule generation
- [ ] Verify schedule makes logical sense
- [ ] Check UI displays correctly
- [ ] Test edge cases (holidays, weekends)

### 2. Performance Testing
- [ ] Measure execution time
- [ ] Check memory usage
- [ ] Verify database impact
- [ ] Monitor for timeouts

### 3. Data Integrity
- [ ] Validate time slot consistency
- [ ] Check stage ordering preservation
- [ ] Verify resource availability tracking
- [ ] Confirm scheduling completeness

---
**NEVER SKIP THIS CHECKLIST - RESTORE IS PAINFUL**