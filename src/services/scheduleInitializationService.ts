import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, addDays, format } from 'date-fns';
import { enhanceSupabaseError, logApiCall } from '@/utils/errorLogging';

interface JobForScheduling {
  id: string;
  wo_no: string;
  customer: string;
  due_date: string;
  production_stage_id: string;
  estimated_duration_minutes: number;
}

interface ScheduleEntry {
  job_id: string;
  job_table_name: string;
  production_stage_id: string;
  scheduled_date: string;
  queue_position: number;
  shift_number: number;
  estimated_duration_minutes: number;
}

export class ScheduleInitializationService {
  /**
   * Initialize schedules for all production stages with real job data
   */
  static async initializeAllSchedules(forceInitialize: boolean = false): Promise<boolean> {
    try {
      console.log('🚀 Initializing production schedules from real job data...');

      // Get all active production stages
      logApiCall('GET', 'production_stages (active)');
      const { data: stages, error: stagesError } = await supabase
        .from('production_stages')
        .select('id, name')
        .eq('is_active', true);

      if (stagesError) {
        enhanceSupabaseError(stagesError, 'Fetching production stages');
        throw stagesError;
      }

      // Get jobs that need scheduling (active stage instances)
      const { data: jobsData, error: jobsError } = await supabase
        .from('job_stage_instances')
        .select(`
          job_id,
          production_stage_id,
          estimated_duration_minutes,
          job_table_name,
          production_jobs!inner(
            id,
            wo_no,
            customer,
            due_date,
            status
          )
        `)
        .in('status', ['active', 'pending'])
        .eq('job_table_name', 'production_jobs')
        .not('production_jobs.status', 'eq', 'Completed');

      if (jobsError) throw jobsError;

      console.log(`📊 Found ${jobsData?.length || 0} jobs across ${stages?.length || 0} stages`);

      if (!stages || stages.length === 0) {
        const errorMsg = 'No active production stages found';
        console.error('❌', errorMsg);
        throw new Error(errorMsg);
      }

      if (!jobsData || jobsData.length === 0) {
        if (forceInitialize) {
          console.log('⚠️ No jobs found but force initialize enabled - creating empty schedules');
          return true;
        } else {
          const errorMsg = 'No jobs found that need scheduling. Use Force Initialize to create empty schedules.';
          console.error('❌', errorMsg);
          throw new Error(errorMsg);
        }
      }

      // Group jobs by stage
      const jobsByStage = new Map<string, JobForScheduling[]>();
      
      jobsData.forEach((jobInstance: any) => {
        const stageId = jobInstance.production_stage_id;
        const job: JobForScheduling = {
          id: jobInstance.job_id,
          wo_no: jobInstance.production_jobs.wo_no,
          customer: jobInstance.production_jobs.customer,
          due_date: jobInstance.production_jobs.due_date,
          production_stage_id: stageId,
          estimated_duration_minutes: jobInstance.estimated_duration_minutes || 120 // Default 2 hours
        };

        if (!jobsByStage.has(stageId)) {
          jobsByStage.set(stageId, []);
        }
        jobsByStage.get(stageId)!.push(job);
      });

      // Create schedules for each stage
      const currentWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
      let totalScheduledJobs = 0;

      for (const [stageId, stageJobs] of jobsByStage) {
        const stageName = stages.find(s => s.id === stageId)?.name || 'Unknown Stage';
        console.log(`📅 Creating schedule for ${stageName} with ${stageJobs.length} jobs`);

        const scheduleEntries = await this.createStageSchedule(stageId, stageJobs, currentWeek);
        
        if (scheduleEntries.length > 0) {
          const { error: insertError } = await supabase
            .from('production_job_schedules')
            .insert(scheduleEntries);

          if (insertError) {
            console.error(`❌ Failed to save schedule for ${stageName}:`, insertError);
          } else {
            totalScheduledJobs += scheduleEntries.length;
            console.log(`✅ Saved ${scheduleEntries.length} jobs for ${stageName}`);
          }
        }
      }

      console.log(`🎉 Successfully initialized schedules with ${totalScheduledJobs} total job entries`);
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize schedules:', error);
      return false;
    }
  }

  /**
   * Create a schedule for a specific stage with real job data
   */
  private static async createStageSchedule(
    stageId: string,
    jobs: JobForScheduling[],
    weekStart: Date
  ): Promise<ScheduleEntry[]> {
    if (jobs.length === 0) return [];

    // Sort jobs by due date (earliest first) then by customer
    const sortedJobs = jobs.sort((a, b) => {
      const dateA = new Date(a.due_date);
      const dateB = new Date(b.due_date);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime();
      }
      return a.customer.localeCompare(b.customer);
    });

    const scheduleEntries: ScheduleEntry[] = [];
    const dailyCapacityMinutes = 8 * 60; // 8 hours per day
    const workingDaysPerWeek = 5; // Monday to Friday

    // Track utilization for each day
    const dailyUtilization = new Map<string, number>();

    // Schedule jobs across the week, starting from Monday
    let currentJobIndex = 0;
    
    for (let dayOffset = 0; dayOffset < workingDaysPerWeek && currentJobIndex < sortedJobs.length; dayOffset++) {
      const scheduleDate = addDays(weekStart, dayOffset);
      const dateKey = format(scheduleDate, 'yyyy-MM-dd');
      
      let dayUtilization = dailyUtilization.get(dateKey) || 0;
      let queuePosition = 1;

      // Fill this day with jobs until capacity is reached
      while (currentJobIndex < sortedJobs.length && dayUtilization < dailyCapacityMinutes) {
        const job = sortedJobs[currentJobIndex];
        const jobDuration = Math.min(job.estimated_duration_minutes, dailyCapacityMinutes - dayUtilization);

        if (jobDuration <= 0) break;

        scheduleEntries.push({
          job_id: job.id,
          job_table_name: 'production_jobs',
          production_stage_id: stageId,
          scheduled_date: dateKey,
          queue_position: queuePosition,
          shift_number: 1, // Single shift for now
          estimated_duration_minutes: jobDuration
        });

        dayUtilization += jobDuration;
        dailyUtilization.set(dateKey, dayUtilization);
        queuePosition++;
        currentJobIndex++;
      }
    }

    // If there are remaining jobs, spread them across the week
    if (currentJobIndex < sortedJobs.length) {
      console.log(`⚠️ ${sortedJobs.length - currentJobIndex} jobs couldn't fit in current week for stage ${stageId}`);
      
      // Add remaining jobs to the least utilized days
      const remainingJobs = sortedJobs.slice(currentJobIndex);
      let dayIndex = 0;
      
      remainingJobs.forEach((job, index) => {
        const scheduleDate = addDays(weekStart, dayIndex % workingDaysPerWeek);
        const dateKey = format(scheduleDate, 'yyyy-MM-dd');
        
        // Find current max queue position for this day
        const existingJobsThisDay = scheduleEntries.filter(entry => entry.scheduled_date === dateKey);
        const maxPosition = existingJobsThisDay.length > 0 
          ? Math.max(...existingJobsThisDay.map(e => e.queue_position))
          : 0;

        scheduleEntries.push({
          job_id: job.id,
          job_table_name: 'production_jobs',
          production_stage_id: stageId,
          scheduled_date: dateKey,
          queue_position: maxPosition + 1,
          shift_number: 1,
          estimated_duration_minutes: job.estimated_duration_minutes
        });

        dayIndex++;
      });
    }

    return scheduleEntries;
  }

  /**
   * Check if schedules exist for the current week
   */
  static async hasSchedulesForWeek(weekStart: Date): Promise<boolean> {
    const weekEnd = addDays(weekStart, 6);
    
    const { data, error } = await supabase
      .from('production_job_schedules')
      .select('id')
      .gte('scheduled_date', format(weekStart, 'yyyy-MM-dd'))
      .lte('scheduled_date', format(weekEnd, 'yyyy-MM-dd'))
      .limit(1);

    if (error) {
      console.error('Error checking for existing schedules:', error);
      return false;
    }

    return (data?.length || 0) > 0;
  }

  /**
   * Clear all schedules and regenerate from scratch
   */
  static async regenerateAllSchedules(forceInitialize: boolean = false): Promise<boolean> {
    try {
      console.log('🔄 Clearing all existing schedules...');
      
      // Clear existing schedules
      const { error: clearError } = await supabase
        .from('production_job_schedules')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (clearError) throw clearError;

      console.log('✅ Cleared existing schedules');
      
      // Regenerate schedules
      return await this.initializeAllSchedules(forceInitialize);
    } catch (error) {
      console.error('❌ Failed to regenerate schedules:', error);
      return false;
    }
  }
}