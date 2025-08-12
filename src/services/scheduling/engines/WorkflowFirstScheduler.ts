import { supabase } from "@/integrations/supabase/client";
import { workflowAnalyzer, JobWorkflow } from "../core/WorkflowAnalyzer";
import { workingHoursManager } from "../core/WorkingHoursManager";
import { multiDayJobSplitter } from "../core/MultiDayJobSplitter";
import { capacityTracker } from "../core/CapacityTracker";
import { parallelPathProcessor } from "./ParallelPathProcessor";
import { convergenceProcessor } from "./ConvergenceProcessor";

export interface SchedulingResult {
  success: boolean;
  jobId: string;
  scheduledCompletionDate: Date;
  totalDurationMinutes: number;
  errors: string[];
  warnings: string[];
  pathResults: {
    coverPathEnd?: Date;
    textPathEnd?: Date;
    convergenceEnd?: Date;
  };
}

export class WorkflowFirstScheduler {
  /**
   * Main orchestrator - follows the mermaid diagram exactly
   * 1. Analyze workflow paths (cover, text, convergence)
   * 2. Schedule cover path completely
   * 3. Schedule text path completely  
   * 4. Wait for BOTH paths to complete
   * 5. Schedule convergence path
   */
  async scheduleJob(jobId: string, jobTableName: string = 'production_jobs'): Promise<SchedulingResult> {
    const result: SchedulingResult = {
      success: false,
      jobId,
      scheduledCompletionDate: new Date(),
      totalDurationMinutes: 0,
      errors: [],
      warnings: [],
      pathResults: {}
    };

    try {
      console.log(`🔄 [WORKFLOW-FIRST] Starting job ${jobId} scheduling`);

      // Step 1: Analyze workflow and parse into parallel paths
      const workflow = await workflowAnalyzer.analyzeJobWorkflow(jobId, jobTableName);
      console.log(`📊 Workflow analysis complete:`, {
        coverStages: workflow.coverPath.stages.length,
        textStages: workflow.textPath.stages.length,
        convergenceStages: workflow.convergencePath.stages.length
      });

      // Step 2: Schedule cover path completely (including multi-day splits)
      if (workflow.coverPath.stages.length > 0) {
        console.log(`🔗 Processing cover path (${workflow.coverPath.stages.length} stages)`);
        const coverResult = await parallelPathProcessor.processPath(workflow.coverPath);
        result.pathResults.coverPathEnd = coverResult.pathCompletionDate;
        result.totalDurationMinutes += coverResult.totalDurationMinutes;
        
        if (!coverResult.success) {
          result.errors.push(...coverResult.errors);
        }
        console.log(`✅ Cover path complete: ${coverResult.pathCompletionDate.toISOString()}`);
      }

      // Step 3: Schedule text path completely (including multi-day splits)
      if (workflow.textPath.stages.length > 0) {
        console.log(`📝 Processing text path (${workflow.textPath.stages.length} stages)`);
        const textResult = await parallelPathProcessor.processPath(workflow.textPath);
        result.pathResults.textPathEnd = textResult.pathCompletionDate;
        result.totalDurationMinutes += textResult.totalDurationMinutes;
        
        if (!textResult.success) {
          result.errors.push(...textResult.errors);
        }
        console.log(`✅ Text path complete: ${textResult.pathCompletionDate.toISOString()}`);
      }

      // Step 4: Calculate convergence start time = MAX(cover end, text end)
      const convergenceStartTime = this.calculateConvergenceStartTime(result.pathResults);
      console.log(`🔀 Convergence starts at: ${convergenceStartTime.toISOString()}`);

      // Step 5: Schedule convergence path (waits for both paths)
      if (workflow.convergencePath.stages.length > 0) {
        console.log(`🎯 Processing convergence path (${workflow.convergencePath.stages.length} stages)`);
        const convergenceResult = await convergenceProcessor.processConvergencePath(
          workflow.convergencePath,
          convergenceStartTime
        );
        result.pathResults.convergenceEnd = convergenceResult.pathCompletionDate;
        result.totalDurationMinutes += convergenceResult.totalDurationMinutes;
        
        if (!convergenceResult.success) {
          result.errors.push(...convergenceResult.errors);
        }
        console.log(`✅ Convergence complete: ${convergenceResult.pathCompletionDate.toISOString()}`);
      }

      // Step 6: Set final completion date and validate
      result.scheduledCompletionDate = result.pathResults.convergenceEnd || 
                                     result.pathResults.textPathEnd || 
                                     result.pathResults.coverPathEnd || 
                                     new Date();

      result.success = result.errors.length === 0;

      console.log(`🎉 [WORKFLOW-FIRST] Job ${jobId} scheduling complete:`, {
        success: result.success,
        finalCompletion: result.scheduledCompletionDate.toISOString(),
        totalMinutes: result.totalDurationMinutes,
        errors: result.errors.length
      });

      return result;

    } catch (error) {
      console.error(`❌ [WORKFLOW-FIRST] Job ${jobId} scheduling failed:`, error);
      result.errors.push(`Scheduling failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  /**
   * Calculate when convergence can start - MAX of all path completion times
   */
  private calculateConvergenceStartTime(pathResults: SchedulingResult['pathResults']): Date {
    const endTimes = [
      pathResults.coverPathEnd,
      pathResults.textPathEnd
    ].filter(date => date !== undefined) as Date[];

    if (endTimes.length === 0) {
      return new Date(); // No paths - start immediately
    }

    // Return the latest completion time
    return new Date(Math.max(...endTimes.map(date => date.getTime())));
  }

  /**
   * Recalculate all job schedules - useful for mass updates
   */
  async recalculateAllJobSchedules(jobIds?: string[]): Promise<{
    successful: number;
    failed: number;
    results: SchedulingResult[];
  }> {
    console.log(`🔄 [WORKFLOW-FIRST] Recalculating schedules for ${jobIds?.length || 'all'} jobs`);

    // Reset capacity tracking for fresh calculation
    await capacityTracker.resetCapacityTracking();

    const results: SchedulingResult[] = [];
    let successful = 0;
    let failed = 0;

    // If no specific jobs provided, get all active jobs
    const targetJobIds = jobIds || await this.getAllActiveJobIds();

    for (const jobId of targetJobIds) {
      try {
        const result = await this.scheduleJob(jobId);
        results.push(result);
        
        if (result.success) {
          successful++;
        } else {
          failed++;
          console.warn(`⚠️ Job ${jobId} scheduling failed:`, result.errors);
        }
      } catch (error) {
        failed++;
        console.error(`❌ Job ${jobId} scheduling error:`, error);
        results.push({
          success: false,
          jobId,
          scheduledCompletionDate: new Date(),
          totalDurationMinutes: 0,
          errors: [`Unexpected error: ${error instanceof Error ? error.message : 'Unknown'}`],
          warnings: [],
          pathResults: {}
        });
      }
    }

    console.log(`📊 [WORKFLOW-FIRST] Recalculation complete: ${successful} successful, ${failed} failed`);
    return { successful, failed, results };
  }

  private async getAllActiveJobIds(): Promise<string[]> {
    const { data: jobs } = await supabase
      .from('production_jobs')
      .select('id')
      .neq('status', 'Completed');

    return jobs?.map(j => j.id) || [];
  }
}

export const workflowFirstScheduler = new WorkflowFirstScheduler();