# Batch Tracking System Documentation

## Overview
The Batch Tracking System provides comprehensive batch processing capabilities integrated with the production workflow, allowing jobs to be processed individually or as consolidated batches for efficiency.

## Key Features

### 1. Batch Decision Workflow
- **Proof Approval**: After proof sign-off, users can choose individual processing or batch allocation
- **Category Validation**: Only compatible job categories can be batched together
- **Automatic Routing**: Jobs are routed to appropriate workflow based on decision

### 2. Batch Master Jobs
- **Consolidated Representation**: Multiple individual jobs represented as single batch entity
- **Workflow Integration**: Batch jobs follow same stage progression as individual jobs
- **Print Queue Management**: Batch jobs appear in print queue instead of individual jobs

### 3. Batch Splitting
- **Stage-Based Splitting**: Automatic splitting at packaging/finishing stages
- **Manual Splitting**: Users can manually split batches when needed
- **Workflow Continuity**: Individual jobs continue through remaining stages after split

### 4. Status Tracking
- **Dual Status System**: Both batch and individual job statuses are maintained
- **Real-time Updates**: Status changes propagate between batch and constituent jobs
- **Audit Trail**: Complete history of batch operations and status changes

## Architecture

### Core Services

#### BatchSplittingService
```typescript
// Location: src/utils/batch/batchSplittingService.ts
// Purpose: Handles batch splitting operations with audit trail
```

#### UnifiedBatchProcessor 
```typescript
// Location: src/utils/batch/unifiedBatchProcessor.ts
// Purpose: Orchestrates batch creation and processing
```

### Key Hooks

#### useBatchAwareProductionJobs
```typescript
// Location: src/hooks/tracker/useBatchAwareProductionJobs.tsx
// Purpose: Provides batch-aware job data with filtering and context
```

#### useBatchSplitting
```typescript
// Location: src/hooks/tracker/useBatchSplitting.tsx
// Purpose: Manages batch splitting operations
```

#### useBatchStageProgression
```typescript
// Location: src/hooks/tracker/useBatchStageProgression.tsx
// Purpose: Handles stage advancement for batch jobs
```

#### useBatchAwareStageActions
```typescript
// Location: src/hooks/tracker/stage-management/useBatchAwareStageActions.tsx
// Purpose: Enhanced stage actions with batch awareness
```

### UI Components

#### BatchAwareJobCard
```typescript
// Location: src/components/tracker/BatchAwareJobCard.tsx
// Purpose: Job card with comprehensive batch context display
```

#### BatchContextIndicator
```typescript
// Location: src/components/tracker/BatchAwareJobCard.tsx
// Purpose: Visual indicator for batch status and context
```

#### BatchSplitDetector
```typescript
// Location: src/components/tracker/batch/BatchSplitDetector.tsx
// Purpose: Detects when batch splitting should be offered
```

## Database Schema

### Core Tables

#### batch_job_references
- **Purpose**: Links production jobs to batch jobs
- **Key Fields**: production_job_id, batch_id, batch_job_id, status

#### production_jobs
- **Batch Fields**: 
  - `batch_ready`: Boolean indicating job is ready for batching
  - `batch_category`: Category for batch compatibility validation
  - `is_batch_master`: Identifies batch master jobs

### Functions

#### mark_job_ready_for_batching
```sql
-- Marks individual jobs as ready for batch processing
-- Updates batch_ready flag and allocation metadata
```

## Workflow States

### Individual Job States
1. **Pre-Batch**: Job in normal workflow
2. **Batch Ready**: Job marked for potential batching
3. **In Batch Processing**: Job part of active batch
4. **Post-Split**: Job returned to individual workflow

### Batch Job States
1. **Batch Created**: Batch master job created
2. **In Production**: Batch progressing through stages
3. **Ready for Split**: Batch at packaging/finishing stage
4. **Split Complete**: Batch dissolved, jobs individual

## User Workflows

### Creating a Batch
1. Jobs complete proof stage and are approved
2. System presents batch decision modal
3. User chooses "Send to Batch" 
4. Jobs marked as batch ready
5. Batch allocation stage processes compatible jobs into batches
6. Batch master job created and appears in print queue

### Processing a Batch
1. Batch master job appears in print queue
2. Operators work on batch as single entity
3. Batch progresses through printing, cutting stages
4. Status updates apply to entire batch
5. Constituent jobs show "In Batch Processing" status

### Splitting a Batch
1. Batch reaches packaging/finishing stage
2. System detects batch split opportunity
3. Operator chooses to split batch
4. Individual jobs return to normal workflow
5. Jobs continue through remaining stages independently

## Configuration

### Batch Categories
- Business Cards: Can be batched with other business cards
- Flyers: Can be batched with compatible flyers
- Mixed Batches: Allowed with compatible specifications

### Stage Configuration
- **Batch Allocation Stage**: Conditional stage for batch processing
- **Packaging Stage**: Default split point for batches
- **Manual Split**: Available at any active stage

## Monitoring and Reporting

### Batch Metrics
- Batch creation rate and efficiency
- Average batch size and processing time
- Split timing and frequency
- Resource utilization comparison (batch vs individual)

### Status Dashboards
- Real-time batch status tracking
- Constituent job visibility
- Stage progression monitoring
- Performance analytics

## Error Handling

### Validation
- Category compatibility checking
- Stage progression validation
- User permission verification
- Data consistency checks

### Recovery
- Orphaned job detection and recovery
- Failed batch split handling
- Status synchronization repair
- Audit trail integrity

## Best Practices

### For Developers
1. Always use batch-aware hooks when working with production jobs
2. Check batch context before performing job operations
3. Maintain status synchronization between batch and individual jobs
4. Use proper error handling for batch operations

### For Users
1. Verify job compatibility before creating batches
2. Monitor batch progress through dedicated indicators
3. Split batches at appropriate stages for efficiency
4. Use batch search and filtering for better visibility

## Testing

### Unit Tests
- Batch creation and validation logic
- Status synchronization mechanisms
- Split operation integrity
- Error handling scenarios

### Integration Tests
- End-to-end batch workflow
- Multi-user batch operations
- Performance under load
- Data consistency verification

## Troubleshooting

### Common Issues
1. **Jobs not appearing in batch**: Check category compatibility and batch_ready status
2. **Status sync problems**: Verify batch_job_references integrity
3. **Split failures**: Check stage permissions and workflow state
4. **Performance issues**: Monitor batch size and system resources

### Debugging Tools
- Batch operation logs in browser console
- Database query monitoring
- Real-time status tracking
- Audit trail examination

## Migration Notes

### From Previous System
- Existing individual jobs continue to work normally
- No data migration required for basic functionality
- Gradual rollout of batch features possible
- Backward compatibility maintained

### Future Enhancements
- Advanced batch scheduling
- Multi-site batch coordination
- AI-powered batch optimization
- Enhanced reporting and analytics