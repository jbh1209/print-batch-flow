
import { supabase } from "@/integrations/supabase/client";
import type { WorkflowDiagnostic } from "./workflowDiagnostics";

export interface RepairJob {
  job_id: string;
  job_wo_no: string;
  category_id: string;
  category_name: string;
  missing_stages: Array<{
    stage_id: string;
    stage_name: string;
    stage_order: number;
  }>;
  severity: 'critical' | 'moderate' | 'minor';
}

export interface RepairResult {
  job_id: string;
  success: boolean;
  error?: string;
  stages_created: number;
  repair_time_ms: number;
}

export interface StrategyResult {
  strategy_name: string;
  total_jobs: number;
  successful_repairs: number;
  failed_repairs: number;
  total_time_ms: number;
  errors: Array<{ job_id: string; error: string }>;
  repair_details: RepairResult[];
}

export class WorkflowRepairStrategies {
  
  /**
   * Critical Issues First Strategy
   * Prioritizes jobs with the most severe missing stage issues
   */
  static async criticalFirstStrategy(
    diagnostics: WorkflowDiagnostic[]
  ): Promise<StrategyResult> {
    const startTime = Date.now();
    const criticalJobs = diagnostics
      .filter(d => d.issue_severity === 'critical')
      .sort((a, b) => (b.expected_stages - b.actual_stages) - (a.expected_stages - a.actual_stages));

    console.log('🎯 Starting Critical First Strategy', { criticalJobs: criticalJobs.length });

    const repairResults: RepairResult[] = [];
    const errors: Array<{ job_id: string; error: string }> = [];

    for (const job of criticalJobs) {
      try {
        const repairStart = Date.now();
        const success = await this.repairSingleJob(job.job_id, job.category_id);
        const repairTime = Date.now() - repairStart;

        repairResults.push({
          job_id: job.job_id,
          success,
          stages_created: job.expected_stages - job.actual_stages,
          repair_time_ms: repairTime
        });

        if (!success) {
          errors.push({ job_id: job.job_id, error: 'Repair function returned false' });
        }

        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        repairResults.push({
          job_id: job.job_id,
          success: false,
          error: errorMessage,
          stages_created: 0,
          repair_time_ms: 0
        });
        errors.push({ job_id: job.job_id, error: errorMessage });
      }
    }

    return {
      strategy_name: 'Critical Issues First',
      total_jobs: criticalJobs.length,
      successful_repairs: repairResults.filter(r => r.success).length,
      failed_repairs: repairResults.filter(r => !r.success).length,
      total_time_ms: Date.now() - startTime,
      errors,
      repair_details: repairResults
    };
  }

  /**
   * Category-Based Strategy
   * Groups jobs by category and repairs one category at a time
   */
  static async categoryBasedStrategy(
    diagnostics: WorkflowDiagnostic[]
  ): Promise<StrategyResult> {
    const startTime = Date.now();
    
    // Group jobs by category
    const jobsByCategory = diagnostics.reduce((acc, job) => {
      if (!acc[job.category_name]) {
        acc[job.category_name] = [];
      }
      acc[job.category_name].push(job);
      return acc;
    }, {} as Record<string, WorkflowDiagnostic[]>);

    console.log('📂 Starting Category-Based Strategy', { 
      categories: Object.keys(jobsByCategory).length,
      totalJobs: diagnostics.length 
    });

    const repairResults: RepairResult[] = [];
    const errors: Array<{ job_id: string; error: string }> = [];

    // Process each category
    for (const [categoryName, categoryJobs] of Object.entries(jobsByCategory)) {
      console.log(`🔄 Processing category: ${categoryName} (${categoryJobs.length} jobs)`);

      for (const job of categoryJobs) {
        try {
          const repairStart = Date.now();
          const success = await this.repairSingleJob(job.job_id, job.category_id);
          const repairTime = Date.now() - repairStart;

          repairResults.push({
            job_id: job.job_id,
            success,
            stages_created: job.expected_stages - job.actual_stages,
            repair_time_ms: repairTime
          });

          if (!success) {
            errors.push({ job_id: job.job_id, error: 'Repair function returned false' });
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          repairResults.push({
            job_id: job.job_id,
            success: false,
            error: errorMessage,
            stages_created: 0,
            repair_time_ms: 0
          });
          errors.push({ job_id: job.job_id, error: errorMessage });
        }
      }

      // Small delay between categories
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return {
      strategy_name: 'Category-Based Repair',
      total_jobs: diagnostics.length,
      successful_repairs: repairResults.filter(r => r.success).length,
      failed_repairs: repairResults.filter(r => !r.success).length,
      total_time_ms: Date.now() - startTime,
      errors,
      repair_details: repairResults
    };
  }

  /**
   * Incremental Strategy
   * Repairs jobs in small batches with validation between batches
   */
  static async incrementalStrategy(
    diagnostics: WorkflowDiagnostic[],
    batchSize: number = 5
  ): Promise<StrategyResult> {
    const startTime = Date.now();
    
    console.log('📈 Starting Incremental Strategy', { 
      totalJobs: diagnostics.length, 
      batchSize 
    });

    const repairResults: RepairResult[] = [];
    const errors: Array<{ job_id: string; error: string }> = [];

    // Process in batches
    for (let i = 0; i < diagnostics.length; i += batchSize) {
      const batch = diagnostics.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(diagnostics.length / batchSize);

      console.log(`🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} jobs)`);

      // Process batch
      for (const job of batch) {
        try {
          const repairStart = Date.now();
          const success = await this.repairSingleJob(job.job_id, job.category_id);
          const repairTime = Date.now() - repairStart;

          repairResults.push({
            job_id: job.job_id,
            success,
            stages_created: job.expected_stages - job.actual_stages,
            repair_time_ms: repairTime
          });

          if (!success) {
            errors.push({ job_id: job.job_id, error: 'Repair function returned false' });
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          repairResults.push({
            job_id: job.job_id,
            success: false,
            error: errorMessage,
            stages_created: 0,
            repair_time_ms: 0
          });
          errors.push({ job_id: job.job_id, error: errorMessage });
        }
      }

      // Validate batch results
      const batchSuccesses = repairResults.slice(-batch.length).filter(r => r.success).length;
      console.log(`✅ Batch ${batchNumber} completed: ${batchSuccesses}/${batch.length} successful`);

      // Delay between batches
      if (i + batchSize < diagnostics.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return {
      strategy_name: 'Incremental Repair',
      total_jobs: diagnostics.length,
      successful_repairs: repairResults.filter(r => r.success).length,
      failed_repairs: repairResults.filter(r => !r.success).length,
      total_time_ms: Date.now() - startTime,
      errors,
      repair_details: repairResults
    };
  }

  /**
   * Bulk Strategy
   * Repairs all jobs simultaneously for maximum speed
   */
  static async bulkStrategy(
    diagnostics: WorkflowDiagnostic[]
  ): Promise<StrategyResult> {
    const startTime = Date.now();
    
    console.log('⚡ Starting Bulk Strategy', { totalJobs: diagnostics.length });

    const repairPromises = diagnostics.map(async (job): Promise<RepairResult> => {
      try {
        const repairStart = Date.now();
        const success = await this.repairSingleJob(job.job_id, job.category_id);
        const repairTime = Date.now() - repairStart;

        return {
          job_id: job.job_id,
          success,
          stages_created: job.expected_stages - job.actual_stages,
          repair_time_ms: repairTime
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          job_id: job.job_id,
          success: false,
          error: errorMessage,
          stages_created: 0,
          repair_time_ms: 0
        };
      }
    });

    const repairResults = await Promise.all(repairPromises);
    const errors = repairResults
      .filter(r => !r.success)
      .map(r => ({ job_id: r.job_id, error: r.error || 'Unknown error' }));

    return {
      strategy_name: 'Bulk Repair',
      total_jobs: diagnostics.length,
      successful_repairs: repairResults.filter(r => r.success).length,
      failed_repairs: repairResults.filter(r => !r.success).length,
      total_time_ms: Date.now() - startTime,
      errors,
      repair_details: repairResults
    };
  }

  /**
   * Helper method to repair a single job
   */
  private static async repairSingleJob(jobId: string, categoryId: string): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('initialize_job_stages_auto', {
        p_job_id: jobId,
        p_job_table_name: 'production_jobs',
        p_category_id: categoryId
      });

      if (error) {
        console.error(`❌ Failed to repair job ${jobId}:`, error);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`❌ Exception repairing job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Validates repair results by checking if stages were actually created
   */
  static async validateRepairResults(jobIds: string[]): Promise<{
    validated: number;
    stillBroken: string[];
  }> {
    try {
      const { data: stageInstances, error } = await supabase
        .from('job_stage_instances')
        .select('job_id, production_stage_id')
        .in('job_id', jobIds)
        .eq('job_table_name', 'production_jobs');

      if (error) throw error;

      const jobsWithStages = new Set((stageInstances || []).map(s => s.job_id));
      const stillBroken = jobIds.filter(jobId => !jobsWithStages.has(jobId));

      return {
        validated: jobsWithStages.size,
        stillBroken
      };

    } catch (error) {
      console.error('❌ Failed to validate repair results:', error);
      return {
        validated: 0,
        stillBroken: jobIds
      };
    }
  }
}
