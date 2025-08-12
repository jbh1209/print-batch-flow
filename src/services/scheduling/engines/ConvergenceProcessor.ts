import { WorkflowPath } from "../core/WorkflowAnalyzer";
import { workingHoursManager } from "../core/WorkingHoursManager";
import { multiDayJobSplitter } from "../core/MultiDayJobSplitter";
import { capacityTracker } from "../core/CapacityTracker";
import { PathProcessingResult } from "./ParallelPathProcessor";

export class ConvergenceProcessor {
  /**
   * Process convergence path - stages that run after BOTH cover and text paths complete
   * These stages wait for MAX(cover_end, text_end) before starting
   */
  async processConvergencePath(
    convergencePath: WorkflowPath,
    convergenceStartTime: Date
  ): Promise<PathProcessingResult> {
    const result: PathProcessingResult = {
      success: true,
      pathCompletionDate: convergenceStartTime,
      totalDurationMinutes: 0,
      errors: [],
      stageCompletions: []
    };

    if (convergencePath.stages.length === 0) {
      console.log(`🔀 No convergence stages to process`);
      return result;
    }

    console.log(`🔀 Processing convergence path starting at: ${convergenceStartTime.toISOString()}`);

    // Ensure convergence starts on a working day at working hours
    const workingStartTime = await this.ensureWorkingHoursStart(convergenceStartTime);
    let currentCompletionTime = workingStartTime;

    console.log(`🕐 Adjusted convergence start to working hours: ${workingStartTime.toISOString()}`);

    // Process convergence stages in sequence
    for (let i = 0; i < convergencePath.stages.length; i++) {
      const stage = convergencePath.stages[i];
      
      try {
        console.log(`  🎯 Scheduling convergence stage: ${stage.stage_name} (${stage.estimated_duration_minutes} min)`);

        // Check if stage needs splitting across multiple days
        const needsSplit = await multiDayJobSplitter.needsSplitting(currentCompletionTime, stage.estimated_duration_minutes);

        if (needsSplit) {
          console.log(`    🔄 Convergence stage requires multi-day split`);
          
          // Split the job across working days
          const splitResult = await multiDayJobSplitter.splitJobAcrossDays(
            currentCompletionTime,
            stage.estimated_duration_minutes
          );

          // Create split stage instances
          await multiDayJobSplitter.createSplitStageInstances(stage.id, splitResult.splits);

          // Update capacity tracking for each split
          for (const split of splitResult.splits) {
            await capacityTracker.updateStageQueueEndTime(
              stage.production_stage_id,
              split.endTime,
              split.durationMinutes
            );
          }

          currentCompletionTime = splitResult.finalCompletionDate;
          
          result.stageCompletions.push({
            stageId: stage.id,
            stageName: stage.stage_name,
            startTime: splitResult.splits[0].startTime,
            endTime: splitResult.finalCompletionDate,
            wasSplit: true
          });

          console.log(`    ✅ Convergence split complete: ${splitResult.splits.length} parts, ends ${splitResult.finalCompletionDate.toISOString()}`);

        } else {
          console.log(`    📅 Single-day convergence scheduling`);
          
          // Schedule as single stage - consider stage capacity and queue
          const scheduleResult = await capacityTracker.scheduleStage(
            stage.id,
            stage.production_stage_id,
            stage.estimated_duration_minutes,
            currentCompletionTime
          );

          currentCompletionTime = scheduleResult.endTime;
          
          result.stageCompletions.push({
            stageId: stage.id,
            stageName: stage.stage_name,
            startTime: scheduleResult.startTime,
            endTime: scheduleResult.endTime,
            wasSplit: false
          });

          console.log(`    ✅ Convergence scheduled: ${scheduleResult.startTime.toISOString()} → ${scheduleResult.endTime.toISOString()}`);
        }

        result.totalDurationMinutes += stage.estimated_duration_minutes;

      } catch (error) {
        console.error(`    ❌ Error scheduling convergence stage ${stage.stage_name}:`, error);
        result.errors.push(`Failed to schedule convergence ${stage.stage_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.success = false;
      }
    }

    result.pathCompletionDate = currentCompletionTime;
    
    console.log(`🏁 Convergence path complete: ${result.pathCompletionDate.toISOString()} (${result.totalDurationMinutes} min total)`);
    
    return result;
  }

  /**
   * Ensure convergence starts during working hours on a working day
   */
  private async ensureWorkingHoursStart(convergenceStartTime: Date): Promise<Date> {
    const convergenceDate = new Date(convergenceStartTime);
    
    // Check if it's a working day
    if (!(await workingHoursManager.isWorkingDay(convergenceDate))) {
      console.log(`    📅 Convergence date is not a working day, moving to next working day`);
      const nextWorkingDay = await workingHoursManager.getNextWorkingDay(convergenceDate);
      return await workingHoursManager.getWorkingDayStart(nextWorkingDay);
    }

    // Check if it's within working hours
    const workDayStart = await workingHoursManager.getWorkingDayStart(convergenceDate);
    const workDayEnd = await workingHoursManager.getWorkingDayEnd(convergenceDate);

    if (convergenceStartTime < workDayStart) {
      console.log(`    🕐 Convergence time before working hours, adjusting to work start`);
      return workDayStart;
    }

    if (convergenceStartTime >= workDayEnd) {
      console.log(`    🕐 Convergence time after working hours, moving to next working day`);
      const nextWorkingDay = await workingHoursManager.getNextWorkingDay(convergenceDate);
      return await workingHoursManager.getWorkingDayStart(nextWorkingDay);
    }

    return convergenceStartTime;
  }

  /**
   * Validate convergence timing - ensure it doesn't start before dependencies complete
   */
  validateConvergenceTiming(
    convergenceStartTime: Date,
    coverPathEnd?: Date,
    textPathEnd?: Date
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (coverPathEnd && convergenceStartTime < coverPathEnd) {
      errors.push(`Convergence starts before cover path completes (${coverPathEnd.toISOString()})`);
    }

    if (textPathEnd && convergenceStartTime < textPathEnd) {
      errors.push(`Convergence starts before text path completes (${textPathEnd.toISOString()})`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export const convergenceProcessor = new ConvergenceProcessor();