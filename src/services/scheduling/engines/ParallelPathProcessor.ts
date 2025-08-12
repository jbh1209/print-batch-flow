import { WorkflowPath } from "../core/WorkflowAnalyzer";
import { workingHoursManager } from "../core/WorkingHoursManager";
import { multiDayJobSplitter } from "../core/MultiDayJobSplitter";
import { capacityTracker } from "../core/CapacityTracker";

export interface PathProcessingResult {
  success: boolean;
  pathCompletionDate: Date;
  totalDurationMinutes: number;
  errors: string[];
  stageCompletions: Array<{
    stageId: string;
    stageName: string;
    startTime: Date;
    endTime: Date;
    wasSplit: boolean;
  }>;
}

export class ParallelPathProcessor {
  /**
   * Process a single workflow path (cover OR text) completely
   * Schedules all stages in sequence, respecting dependencies and capacity
   */
  async processPath(path: WorkflowPath): Promise<PathProcessingResult> {
    const result: PathProcessingResult = {
      success: true,
      pathCompletionDate: new Date(),
      totalDurationMinutes: 0,
      errors: [],
      stageCompletions: []
    };

    if (path.stages.length === 0) {
      return result;
    }

    console.log(`🛤️ Processing ${path.type} path with ${path.stages.length} stages`);

    let pathCompletionTime = new Date();

    // Process stages in order
    for (let i = 0; i < path.stages.length; i++) {
      const stage = path.stages[i];
      
      try {
        console.log(`  📋 Scheduling stage: ${stage.stage_name} (${stage.estimated_duration_minutes} min)`);

        // Calculate when this stage can start (after previous stage or immediately)
        const stageStartTime = i === 0 ? new Date() : pathCompletionTime;

        // Check if stage needs splitting across multiple days
        const needsSplit = await multiDayJobSplitter.needsSplitting(stageStartTime, stage.estimated_duration_minutes);

        if (needsSplit) {
          console.log(`    🔄 Stage requires multi-day split`);
          
          // Split the job across working days
          const splitResult = await multiDayJobSplitter.splitJobAcrossDays(
            stageStartTime,
            stage.estimated_duration_minutes
          );

          // Create split stage instances (now stores metadata only)
          await multiDayJobSplitter.createSplitStageInstances(stage.id, splitResult.splits);

          // PHASE 4: Update capacity tracking with split metadata  
          const splitMetadata = {
            totalSplits: splitResult.splits.length,
            splits: splitResult.splits.map(split => ({
              startTime: split.startTime.toISOString(),
              endTime: split.endTime.toISOString(),
              durationMinutes: split.durationMinutes
            }))
          };

          await capacityTracker.updateStageQueueEndTime(
            stage.production_stage_id,
            splitResult.finalCompletionDate,
            splitResult.totalDuration,
            splitMetadata
          );

          pathCompletionTime = splitResult.finalCompletionDate;
          
          result.stageCompletions.push({
            stageId: stage.id,
            stageName: stage.stage_name,
            startTime: splitResult.splits[0].startTime,
            endTime: splitResult.finalCompletionDate,
            wasSplit: true
          });

          console.log(`    ✅ Split complete: ${splitResult.splits.length} parts, ends ${splitResult.finalCompletionDate.toISOString()}`);

        } else {
          console.log(`    📅 Single-day scheduling`);
          
          // Schedule as single stage
          const scheduleResult = await capacityTracker.scheduleStage(
            stage.id,
            stage.production_stage_id,
            stage.estimated_duration_minutes,
            stageStartTime
          );

          pathCompletionTime = scheduleResult.endTime;
          
          result.stageCompletions.push({
            stageId: stage.id,
            stageName: stage.stage_name,
            startTime: scheduleResult.startTime,
            endTime: scheduleResult.endTime,
            wasSplit: false
          });

          console.log(`    ✅ Scheduled: ${scheduleResult.startTime.toISOString()} → ${scheduleResult.endTime.toISOString()}`);
        }

        result.totalDurationMinutes += stage.estimated_duration_minutes;

      } catch (error) {
        console.error(`    ❌ Error scheduling stage ${stage.stage_name}:`, error);
        result.errors.push(`Failed to schedule ${stage.stage_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.success = false;
      }
    }

    result.pathCompletionDate = pathCompletionTime;
    
    console.log(`🏁 ${path.type} path complete: ${result.pathCompletionDate.toISOString()} (${result.totalDurationMinutes} min total)`);
    
    return result;
  }

  /**
   * Process multiple paths in parallel (when they don't have dependencies)
   * Currently not used but prepared for future optimization
   */
  async processPathsInParallel(paths: WorkflowPath[]): Promise<PathProcessingResult[]> {
    const promises = paths.map(path => this.processPath(path));
    return Promise.all(promises);
  }

  /**
   * Validate a path can be processed (all stages exist and have durations)
   */
  validatePath(path: WorkflowPath): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (path.stages.length === 0) {
      return { valid: true, errors: [] }; // Empty path is valid
    }

    for (const stage of path.stages) {
      if (!stage.production_stage_id) {
        errors.push(`Stage ${stage.stage_name} missing production stage ID`);
      }
      
      if (!stage.estimated_duration_minutes || stage.estimated_duration_minutes <= 0) {
        errors.push(`Stage ${stage.stage_name} has invalid duration: ${stage.estimated_duration_minutes}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export const parallelPathProcessor = new ParallelPathProcessor();