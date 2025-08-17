import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface JobScheduleInfo {
  id: string;
  job_id: string;
  production_stage_id: string;
  stage_name: string;
  estimated_duration_minutes: number;
  created_at: string;
  status: string;
  wo_no?: string;
}

interface ScheduledJob {
  original_instance_id: string;
  job_id: string;
  production_stage_id: string;
  stage_name: string;
  wo_no?: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  scheduled_minutes: number;
  is_split_job: boolean;
  split_job_part: number;
  split_job_total_parts: number;
  container_day: string;
  remaining_minutes?: number;
}

class UniversalContainerScheduler {
  private readonly CONTAINER_CAPACITY_MINUTES = 480; // 8 hours * 60 minutes
  private readonly WORK_START_HOUR = 8; // 8:00 AM
  private readonly BASE_SCHEDULE_DATE = new Date('2025-08-18T08:00:00.000Z');
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  async getAllActiveJobs(): Promise<JobScheduleInfo[]> {
    const { data: jobs, error } = await this.supabase
      .from('job_stage_instances')
      .select(`
        id,
        job_id,
        production_stage_id,
        estimated_duration_minutes,
        created_at,
        status,
        production_stages!inner(name),
        production_jobs!inner(wo_no)
      `)
      .in('status', ['active', 'pending'])
      .not('estimated_duration_minutes', 'is', null)
      .order('created_at');

    if (error) {
      console.error('Error fetching active jobs:', error);
      throw error;
    }

    return (jobs || []).map((job: any) => ({
      id: job.id,
      job_id: job.job_id,
      production_stage_id: job.production_stage_id,
      stage_name: job.production_stages.name,
      estimated_duration_minutes: job.estimated_duration_minutes || 60,
      created_at: job.created_at,
      status: job.status,
      wo_no: job.production_jobs?.wo_no
    }));
  }

  private getNextWorkingDay(currentDate: Date): Date {
    const nextDay = new Date(currentDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    
    const dayOfWeek = nextDay.getUTCDay();
    if (dayOfWeek === 6) { // Saturday
      nextDay.setUTCDate(nextDay.getUTCDate() + 2); // Move to Monday
    } else if (dayOfWeek === 0) { // Sunday
      nextDay.setUTCDate(nextDay.getUTCDate() + 1); // Move to Monday
    }
    
    nextDay.setUTCHours(this.WORK_START_HOUR, 0, 0, 0);
    return nextDay;
  }

  private scheduleJobsForStage(jobs: JobScheduleInfo[]): ScheduledJob[] {
    const scheduledJobs: ScheduledJob[] = [];
    let currentContainerDate = new Date(this.BASE_SCHEDULE_DATE);
    let currentContainerUsedMinutes = 0;

    for (const job of jobs) {
      let remainingMinutes = job.estimated_duration_minutes;
      let partNumber = 1;
      let totalParts = 1;

      if (remainingMinutes > this.CONTAINER_CAPACITY_MINUTES) {
        totalParts = Math.ceil(remainingMinutes / this.CONTAINER_CAPACITY_MINUTES);
      }

      while (remainingMinutes > 0) {
        const availableMinutes = this.CONTAINER_CAPACITY_MINUTES - currentContainerUsedMinutes;
        
        if (availableMinutes <= 0) {
          currentContainerDate = this.getNextWorkingDay(currentContainerDate);
          currentContainerUsedMinutes = 0;
          continue;
        }

        const jobPartMinutes = Math.min(remainingMinutes, availableMinutes);
        
        const startTime = new Date(currentContainerDate.getTime() + (currentContainerUsedMinutes * 60 * 1000));
        const endTime = new Date(startTime.getTime() + (jobPartMinutes * 60 * 1000));

        const scheduledJob: ScheduledJob = {
          original_instance_id: job.id,
          job_id: job.job_id,
          production_stage_id: job.production_stage_id,
          stage_name: job.stage_name,
          wo_no: job.wo_no,
          scheduled_start_at: startTime.toISOString(),
          scheduled_end_at: endTime.toISOString(),
          scheduled_minutes: jobPartMinutes,
          is_split_job: totalParts > 1,
          split_job_part: partNumber,
          split_job_total_parts: totalParts,
          container_day: currentContainerDate.toISOString().split('T')[0],
          remaining_minutes: remainingMinutes - jobPartMinutes
        };

        scheduledJobs.push(scheduledJob);

        currentContainerUsedMinutes += jobPartMinutes;
        remainingMinutes -= jobPartMinutes;
        partNumber++;

        if (currentContainerUsedMinutes >= this.CONTAINER_CAPACITY_MINUTES) {
          currentContainerDate = this.getNextWorkingDay(currentContainerDate);
          currentContainerUsedMinutes = 0;
        }
      }
    }

    return scheduledJobs;
  }

  private groupJobsByStage(jobs: JobScheduleInfo[]): Map<string, JobScheduleInfo[]> {
    const stageJobsMap = new Map<string, JobScheduleInfo[]>();

    for (const job of jobs) {
      const stageKey = job.production_stage_id;
      if (!stageJobsMap.has(stageKey)) {
        stageJobsMap.set(stageKey, []);
      }
      stageJobsMap.get(stageKey)!.push(job);
    }

    stageJobsMap.forEach((stageJobs) => {
      stageJobs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });

    return stageJobsMap;
  }

  async updateScheduledJobs(scheduledJobs: ScheduledJob[]): Promise<void> {
    console.log(`📝 Updating ${scheduledJobs.length} scheduled job records...`);

    for (const scheduledJob of scheduledJobs) {
      if (scheduledJob.is_split_job && scheduledJob.split_job_part > 1) {
        // Create new job stage instance for split parts
        const { error: insertError } = await this.supabase
          .from('job_stage_instances')
          .insert({
            job_id: scheduledJob.job_id,
            job_table_name: 'production_jobs',
            production_stage_id: scheduledJob.production_stage_id,
            stage_order: 999, // Temporary order for split jobs
            status: 'pending',
            scheduled_start_at: scheduledJob.scheduled_start_at,
            scheduled_end_at: scheduledJob.scheduled_end_at,
            scheduled_minutes: scheduledJob.scheduled_minutes,
            is_split_job: true,
            split_job_part: scheduledJob.split_job_part,
            split_job_total_parts: scheduledJob.split_job_total_parts,
            estimated_duration_minutes: scheduledJob.scheduled_minutes
          });

        if (insertError) {
          console.error(`❌ Error inserting split job part ${scheduledJob.split_job_part}:`, insertError);
        } else {
          console.log(`✅ Created split job part ${scheduledJob.split_job_part}/${scheduledJob.split_job_total_parts} for job ${scheduledJob.wo_no}`);
        }
      } else {
        // Update original job stage instance
        const { error: updateError } = await this.supabase
          .from('job_stage_instances')
          .update({
            scheduled_start_at: scheduledJob.scheduled_start_at,
            scheduled_end_at: scheduledJob.scheduled_end_at,
            scheduled_minutes: scheduledJob.scheduled_minutes,
            is_split_job: scheduledJob.is_split_job,
            split_job_part: scheduledJob.split_job_part,
            split_job_total_parts: scheduledJob.split_job_total_parts
          })
          .eq('id', scheduledJob.original_instance_id);

        if (updateError) {
          console.error(`❌ Error updating job ${scheduledJob.wo_no}:`, updateError);
        } else {
          console.log(`✅ Updated job ${scheduledJob.wo_no} - ${scheduledJob.stage_name}`);
        }
      }
    }
  }

  async scheduleAllJobs() {
    console.log('🚀 Universal Container Scheduler: Starting scheduling for all stages...');
    
    const allJobs = await this.getAllActiveJobs();
    console.log(`📊 Found ${allJobs.length} active/pending jobs across all stages`);

    const stageJobsMap = this.groupJobsByStage(allJobs);
    console.log(`🏭 Processing ${stageJobsMap.size} stages`);

    const allScheduledJobs: ScheduledJob[] = [];
    const stageResults = [];
    let totalJobsScheduled = 0;
    let totalSplitJobs = 0;

    for (const [stageId, stageJobs] of stageJobsMap) {
      const stageName = stageJobs[0]?.stage_name || 'Unknown Stage';
      console.log(`⚙️ Scheduling ${stageJobs.length} jobs for stage: ${stageName}`);

      const scheduledJobs = this.scheduleJobsForStage(stageJobs);
      allScheduledJobs.push(...scheduledJobs);
      
      const splitJobsCount = scheduledJobs.filter(job => job.is_split_job).length;
      const totalMinutes = scheduledJobs.reduce((sum, job) => sum + job.scheduled_minutes, 0);
      
      const uniqueDays = new Set(scheduledJobs.map(job => job.container_day));
      const containerDaysUsed = uniqueDays.size;

      stageResults.push({
        stage_id: stageId,
        stage_name: stageName,
        total_jobs: stageJobs.length,
        total_minutes: totalMinutes,
        scheduled_jobs: scheduledJobs,
        split_jobs_count: splitJobsCount,
        container_days_used: containerDaysUsed
      });

      totalJobsScheduled += stageJobs.length;
      totalSplitJobs += splitJobsCount;

      console.log(`✅ Stage ${stageName}: ${stageJobs.length} jobs, ${splitJobsCount} split jobs, ${containerDaysUsed} days`);
    }

    // Update all scheduled jobs in database
    await this.updateScheduledJobs(allScheduledJobs);

    return {
      total_stages_processed: stageJobsMap.size,
      total_jobs_scheduled: totalJobsScheduled,
      total_split_jobs: totalSplitJobs,
      stages: stageResults,
      scheduling_start_date: this.BASE_SCHEDULE_DATE.toISOString()
    };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const scheduler = new UniversalContainerScheduler(supabaseClient);
    const results = await scheduler.scheduleAllJobs();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Universal scheduling completed successfully',
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('❌ Universal scheduler error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: 'Failed to run universal container scheduler'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})