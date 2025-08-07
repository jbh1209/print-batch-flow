import { supabase } from "@/integrations/supabase/client";
import { format, addDays, isWeekend } from "date-fns";

interface JobWorkflow {
  job_id: string;
  job_table_name: string;
  stages: WorkflowStage[];
}

interface WorkflowStage {
  id: string;
  production_stage_id: string;
  stage_order: number;
  estimated_duration_minutes: number;
  stage_name: string;
}

interface ScheduledStage {
  stage_id: string;
  scheduled_date: string;
  queue_position: number;
  start_time: string;
  end_time: string;
  time_slot: string;
}

interface StageCapacity {
  [stageId: string]: {
    [date: string]: number; // allocated minutes for this stage on this date
  };
}

export class FullWorkflowScheduler {
  private static readonly SHIFT_START_HOUR = 8; // 8:00 AM
  private static readonly SHIFT_END_HOUR = 16.5; // 4:30 PM
  private static readonly DAILY_CAPACITY_MINUTES = 510; // 8.5 hours (8AM-4:30PM)
  
  /**
   * Schedule complete job workflows sequentially
   */
  static async scheduleJobWorkflows(): Promise<boolean> {
    try {
      console.log("🔄 Starting full workflow scheduling...");
      
      // Get all jobs that need full workflow scheduling
      const jobWorkflows = await this.getJobWorkflows();
      
      if (jobWorkflows.length === 0) {
        console.log("ℹ️ No job workflows to schedule");
        return true;
      }

      console.log(`📋 Found ${jobWorkflows.length} job workflows to schedule`);
      
      // Initialize stage capacity tracking
      const stageCapacity: StageCapacity = {};
      
      // Schedule each job workflow completely
      for (const jobWorkflow of jobWorkflows) {
        await this.scheduleCompleteJobWorkflow(jobWorkflow, stageCapacity);
      }

      console.log("✅ Full workflow scheduling completed");
      return true;

    } catch (error) {
      console.error("❌ Error in full workflow scheduling:", error);
      return false;
    }
  }

  /**
   * Get all jobs that need workflow scheduling
   */
  private static async getJobWorkflows(): Promise<JobWorkflow[]> {
    // Get jobs with pending stages that don't have scheduled dates
    const { data: pendingStages, error } = await supabase
      .from('job_stage_instances')
      .select(`
        job_id,
        job_table_name,
        id,
        production_stage_id,
        stage_order,
        estimated_duration_minutes,
        scheduled_date,
        production_stages!inner(name)
      `)
      .eq('status', 'pending')
      .eq('job_table_name', 'production_jobs')
      .is('scheduled_date', null)
      .order('job_id')
      .order('stage_order');

    if (error) {
      console.error("❌ Error fetching pending stages:", error);
      return [];
    }

    if (!pendingStages || pendingStages.length === 0) {
      return [];
    }

    // Group by job_id
    const jobWorkflowsMap = new Map<string, JobWorkflow>();
    
    for (const stage of pendingStages) {
      const jobId = stage.job_id;
      
      if (!jobWorkflowsMap.has(jobId)) {
        jobWorkflowsMap.set(jobId, {
          job_id: jobId,
          job_table_name: stage.job_table_name,
          stages: []
        });
      }
      
      const workflow = jobWorkflowsMap.get(jobId)!;
      workflow.stages.push({
        id: stage.id,
        production_stage_id: stage.production_stage_id,
        stage_order: stage.stage_order,
        estimated_duration_minutes: stage.estimated_duration_minutes || 120,
        stage_name: (stage.production_stages as any)?.name || 'Unknown'
      });
    }

    // Sort stages within each workflow by stage_order
    for (const workflow of jobWorkflowsMap.values()) {
      workflow.stages.sort((a, b) => a.stage_order - b.stage_order);
    }

    return Array.from(jobWorkflowsMap.values());
  }

  /**
   * Schedule a complete job workflow sequentially
   */
  private static async scheduleCompleteJobWorkflow(
    jobWorkflow: JobWorkflow, 
    stageCapacity: StageCapacity
  ): Promise<void> {
    console.log(`📅 Scheduling complete workflow for job ${jobWorkflow.job_id}`);
    
    let currentDate = this.getNextWorkingDay(new Date());
    let currentTime = 0; // Minutes from start of shift (8:00 AM)
    
    const scheduledStages: ScheduledStage[] = [];

    // Schedule each stage in sequence
    for (const stage of jobWorkflow.stages) {
      const duration = stage.estimated_duration_minutes;
      
      // Initialize stage capacity tracking if needed
      if (!stageCapacity[stage.production_stage_id]) {
        stageCapacity[stage.production_stage_id] = {};
      }
      
      // Find next available slot for this stage
      const { date, startTime, endTime, queuePosition } = await this.findNextAvailableSlot(
        stage.production_stage_id,
        duration,
        currentDate,
        currentTime,
        stageCapacity
      );
      
      // Create scheduled stage
      const scheduledStage: ScheduledStage = {
        stage_id: stage.id,
        scheduled_date: format(date, 'yyyy-MM-dd'),
        queue_position: queuePosition,
        start_time: startTime,
        end_time: endTime,
        time_slot: `${startTime}-${endTime}`
      };
      
      scheduledStages.push(scheduledStage);
      
      // Update capacity tracking
      const dateKey = format(date, 'yyyy-MM-dd');
      if (!stageCapacity[stage.production_stage_id][dateKey]) {
        stageCapacity[stage.production_stage_id][dateKey] = 0;
      }
      stageCapacity[stage.production_stage_id][dateKey] += duration;
      
      // Next stage starts after this one completes (minimum)
      currentDate = date;
      currentTime = this.timeStringToMinutes(endTime);
      
      // If we're near end of day, move to next day
      if (currentTime >= this.DAILY_CAPACITY_MINUTES - 60) { // Within 1 hour of end
        currentDate = this.getNextWorkingDay(addDays(currentDate, 1));
        currentTime = 0;
      }
      
      console.log(`✅ Scheduled ${stage.stage_name} for job ${jobWorkflow.job_id} on ${dateKey} at ${startTime}-${endTime}`);
    }

    // Update all stage instances with their schedule
    await this.updateJobStageSchedules(jobWorkflow.job_id, scheduledStages);
    
    // Calculate and update job due date
    await this.updateJobDueDate(jobWorkflow.job_id, scheduledStages);
  }

  /**
   * Find the next available time slot for a stage
   */
  private static async findNextAvailableSlot(
    stageId: string,
    duration: number,
    fromDate: Date,
    fromTime: number,
    stageCapacity: StageCapacity
  ): Promise<{ date: Date; startTime: string; endTime: string; queuePosition: number }> {
    
    let checkDate = new Date(fromDate);
    let checkTime = fromTime;
    
    while (true) {
      // Skip weekends
      if (isWeekend(checkDate)) {
        checkDate = addDays(checkDate, 1);
        checkTime = 0;
        continue;
      }
      
      const dateKey = format(checkDate, 'yyyy-MM-dd');
      const allocatedMinutes = stageCapacity[stageId]?.[dateKey] || 0;
      
      // Check if job fits in remaining capacity for this day
      if (checkTime + duration <= this.DAILY_CAPACITY_MINUTES && 
          allocatedMinutes + duration <= this.DAILY_CAPACITY_MINUTES) {
        
        // Calculate queue position for this date/stage
        const queuePosition = await this.getNextQueuePosition(stageId, dateKey);
        
        return {
          date: checkDate,
          startTime: this.minutesToTimeString(checkTime),
          endTime: this.minutesToTimeString(checkTime + duration),
          queuePosition
        };
      }
      
      // Move to next working day
      checkDate = this.getNextWorkingDay(addDays(checkDate, 1));
      checkTime = 0;
    }
  }

  /**
   * Get the next queue position for a stage on a date
   */
  private static async getNextQueuePosition(stageId: string, date: string): Promise<number> {
    const { data, error } = await supabase
      .from('job_stage_instances')
      .select('queue_position')
      .eq('production_stage_id', stageId)
      .eq('scheduled_date', date)
      .order('queue_position', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return 1;
    }

    return (data[0].queue_position || 0) + 1;
  }

  /**
   * Update job stage instances with their schedules
   */
  private static async updateJobStageSchedules(
    jobId: string, 
    scheduledStages: ScheduledStage[]
  ): Promise<void> {
    for (const stage of scheduledStages) {
      await supabase
        .from('job_stage_instances')
        .update({
          scheduled_date: stage.scheduled_date,
          queue_position: stage.queue_position,
          scheduled_start_time: stage.start_time,
          scheduled_end_time: stage.end_time,
          time_slot: stage.time_slot,
          updated_at: new Date().toISOString()
        })
        .eq('id', stage.stage_id);
    }
  }

  /**
   * Update job due date based on final stage completion
   */
  private static async updateJobDueDate(
    jobId: string, 
    scheduledStages: ScheduledStage[]
  ): Promise<void> {
    if (scheduledStages.length === 0) return;
    
    const finalStage = scheduledStages[scheduledStages.length - 1];
    const finalDate = new Date(finalStage.scheduled_date);
    
    // Add 1 day buffer for delivery
    const dueDate = addDays(finalDate, 1);
    
    await supabase
      .from('production_jobs')
      .update({
        queue_calculated_due_date: format(dueDate, 'yyyy-MM-dd'),
        estimated_completion_date: finalStage.scheduled_date,
        last_scheduled_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }

  /**
   * Convert minutes to time string (HH:MM) - starts at 8:00 AM
   */
  private static minutesToTimeString(minutes: number): string {
    const totalMinutes = minutes + (this.SHIFT_START_HOUR * 60);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Convert time string to minutes from start of shift
   */
  private static timeStringToMinutes(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    const totalMinutes = (hours * 60) + minutes;
    return totalMinutes - (this.SHIFT_START_HOUR * 60); // Subtract 8:00 AM offset
  }

  /**
   * Get the next working day (skip weekends)
   */
  private static getNextWorkingDay(date: Date): Date {
    let nextDay = new Date(date);
    while (isWeekend(nextDay)) {
      nextDay = addDays(nextDay, 1);
    }
    return nextDay;
  }

  /**
   * Clear all existing schedules and reschedule full workflows
   */
  static async clearAndRescheduleWorkflows(): Promise<boolean> {
    try {
      console.log("🧹 Clearing existing schedules...");
      
      await supabase
        .from('job_stage_instances')
        .update({
          scheduled_date: null,
          queue_position: null,
          scheduled_start_time: null,
          scheduled_end_time: null,
          time_slot: null
        })
        .eq('status', 'pending')
        .eq('job_table_name', 'production_jobs');

      console.log("✅ Existing schedules cleared");
      
      // Now reschedule complete workflows
      return await this.scheduleJobWorkflows();
      
    } catch (error) {
      console.error("❌ Error in clearAndRescheduleWorkflows:", error);
      return false;
    }
  }
}