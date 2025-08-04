import { supabase } from '@/integrations/supabase/client';

export interface WorkflowStage {
  id: string;
  stage_order: number;
  production_stage_id: string;
  stage_name: string;
  status: string;
  estimated_duration_minutes?: number;
  scheduled_date?: string;
  queue_position?: number;
}

export interface WorkflowChain {
  job_id: string;
  job_wo_no: string;
  job_customer: string;
  stages: WorkflowStage[];
  total_stages: number;
  completed_stages: number;
  current_stage_index: number;
}

export interface SpilloverImpact {
  affected_job_id: string;
  affected_stages: WorkflowStage[];
  original_dates: string[];
  new_dates: string[];
  cascade_days: number;
}

/**
 * Service for managing workflow chains and scheduling dependencies
 */
export class WorkflowChainService {
  
  /**
   * Get the complete workflow chain for a job
   */
  static async getJobWorkflowChain(jobId: string, jobTableName: string = 'production_jobs'): Promise<WorkflowChain | null> {
    try {
      // First get stage instances
      const { data: stageInstances, error } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          stage_order,
          production_stage_id,
          status,
          estimated_duration_minutes,
          production_stages!inner(
            id,
            name
          )
        `)
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName)
        .order('stage_order', { ascending: true });

      if (error) throw error;
      if (!stageInstances || stageInstances.length === 0) return null;

      // Get job details separately
      const { data: jobData, error: jobError } = await supabase
        .from('production_jobs')
        .select('wo_no, customer')
        .eq('id', jobId)
        .single();

      if (jobError) throw jobError;
      if (!jobData) return null;

      // Get scheduled dates for each stage
      const { data: scheduleData } = await supabase
        .from('production_job_schedules')
        .select('production_stage_id, scheduled_date, queue_position')
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName);

      const scheduleMap = new Map(
        scheduleData?.map(s => [s.production_stage_id, s]) || []
      );

      const stages: WorkflowStage[] = stageInstances.map((instance: any) => ({
        id: instance.id,
        stage_order: instance.stage_order,
        production_stage_id: instance.production_stage_id,
        stage_name: instance.production_stages.name,
        status: instance.status,
        estimated_duration_minutes: instance.estimated_duration_minutes,
        scheduled_date: scheduleMap.get(instance.production_stage_id)?.scheduled_date,
        queue_position: scheduleMap.get(instance.production_stage_id)?.queue_position
      }));

      const completedStages = stages.filter(s => s.status === 'completed').length;
      const currentStageIndex = stages.findIndex(s => s.status === 'active') !== -1 
        ? stages.findIndex(s => s.status === 'active')
        : stages.findIndex(s => s.status === 'pending');

      return {
        job_id: jobId,
        job_wo_no: jobData.wo_no,
        job_customer: jobData.customer,
        stages,
        total_stages: stages.length,
        completed_stages: completedStages,
        current_stage_index: Math.max(0, currentStageIndex)
      };

    } catch (error) {
      console.error('Error fetching workflow chain:', error);
      return null;
    }
  }

  /**
   * Calculate spillover impact when a job's stage gets delayed
   */
  static calculateSpilloverImpact(
    workflowChain: WorkflowChain,
    delayedStageIndex: number,
    daysDelta: number
  ): SpilloverImpact {
    const affectedStages = workflowChain.stages.slice(delayedStageIndex);
    const originalDates: string[] = [];
    const newDates: string[] = [];

    affectedStages.forEach((stage, index) => {
      const originalDate = stage.scheduled_date || new Date().toISOString().split('T')[0];
      const newDate = this.addWorkingDays(originalDate, daysDelta + index);
      
      originalDates.push(originalDate);
      newDates.push(newDate);
    });

    return {
      affected_job_id: workflowChain.job_id,
      affected_stages: affectedStages,
      original_dates: originalDates,
      new_dates: newDates,
      cascade_days: daysDelta + affectedStages.length - 1
    };
  }

  /**
   * Get all jobs that will be affected by spillover from a specific date/stage
   */
  static async getAffectedJobsBySpillover(
    stageId: string,
    spilloverDate: string
  ): Promise<WorkflowChain[]> {
    try {
      // Get all jobs scheduled on or after the spillover date for this stage
      const { data: affectedSchedules, error } = await supabase
        .from('production_job_schedules')
        .select(`
          job_id,
          job_table_name,
          queue_position
        `)
        .eq('production_stage_id', stageId)
        .gte('scheduled_date', spilloverDate)
        .order('scheduled_date')
        .order('queue_position');

      if (error) throw error;

      const workflowChains: WorkflowChain[] = [];
      
      for (const schedule of affectedSchedules || []) {
        const chain = await this.getJobWorkflowChain(schedule.job_id, schedule.job_table_name);
        if (chain) {
          workflowChains.push(chain);
        }
      }

      return workflowChains;

    } catch (error) {
      console.error('Error fetching affected jobs:', error);
      return [];
    }
  }

  /**
   * Add working days to a date (skips weekends and holidays)
   */
  private static addWorkingDays(dateString: string, daysToAdd: number): string {
    const date = new Date(dateString);
    let workingDaysAdded = 0;

    while (workingDaysAdded < daysToAdd) {
      date.setDate(date.getDate() + 1);
      
      // Skip weekends (0 = Sunday, 6 = Saturday)
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDaysAdded++;
      }
    }

    return date.toISOString().split('T')[0];
  }

  /**
   * Calculate minimum buffer days between consecutive stages
   */
  static calculateStageBufferDays(fromStage: WorkflowStage, toStage: WorkflowStage): number {
    // For now, use simple 1-day buffer between stages
    // Could be enhanced to consider:
    // - Stage complexity
    // - Historical completion times
    // - Resource availability
    // - Stage dependencies
    
    const orderDifference = toStage.stage_order - fromStage.stage_order;
    return Math.max(1, orderDifference); // Minimum 1 day buffer
  }

  /**
   * Get critical path information for a workflow chain
   */
  static getCriticalPath(workflowChain: WorkflowChain): {
    critical_stages: WorkflowStage[];
    total_duration_days: number;
    bottleneck_stages: WorkflowStage[];
  } {
    const criticalStages = workflowChain.stages.filter(stage => 
      stage.status !== 'completed' && stage.status !== 'skipped'
    );

    const totalDuration = criticalStages.reduce((total, stage) => {
      const stageDays = Math.ceil((stage.estimated_duration_minutes || 120) / (8 * 60)); // Convert to days
      return total + stageDays;
    }, 0);

    // Identify bottleneck stages (ones that take longer than average)
    const averageDuration = totalDuration / criticalStages.length;
    const bottleneckStages = criticalStages.filter(stage => {
      const stageDays = Math.ceil((stage.estimated_duration_minutes || 120) / (8 * 60));
      return stageDays > averageDuration * 1.5; // 50% above average
    });

    return {
      critical_stages: criticalStages,
      total_duration_days: totalDuration,
      bottleneck_stages: bottleneckStages
    };
  }
}