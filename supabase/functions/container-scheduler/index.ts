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
  stage_order: number;
}

interface ScheduledJob {
  instance_id: string;
  job_id: string;
  production_stage_id: string;
  stage_name: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  scheduled_minutes: number;
  is_split_job: boolean;
  split_job_part: number;
  split_job_total_parts: number;
  container_day: string;
}

class ContainerScheduler {
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
        stage_order,
        production_stages!inner(name)
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
      stage_order: job.stage_order
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

  private scheduleJobsIntoContainers(jobs: JobScheduleInfo[]): ScheduledJob[] {
    const scheduledJobs: ScheduledJob[] = [];
    let currentContainerDate = new Date(this.BASE_SCHEDULE_DATE);
    let currentContainerUsedMinutes = 0;

    // Sort jobs by created_at (approval date) for FIFO scheduling
    const sortedJobs = [...jobs].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    for (const job of sortedJobs) {
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
          instance_id: job.id,
          job_id: job.job_id,
          production_stage_id: job.production_stage_id,
          stage_name: job.stage_name,
          scheduled_start_at: startTime.toISOString(),
          scheduled_end_at: endTime.toISOString(),
          scheduled_minutes: jobPartMinutes,
          is_split_job: totalParts > 1,
          split_job_part: partNumber,
          split_job_total_parts: totalParts,
          container_day: currentContainerDate.toISOString().split('T')[0]
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

  async updateSchedulingFields(scheduledJobs: ScheduledJob[]): Promise<void> {
    console.log(`📝 Updating scheduling fields for ${scheduledJobs.length} job instances...`);

    for (const scheduledJob of scheduledJobs) {
      const { error } = await this.supabase
        .from('job_stage_instances')
        .update({
          scheduled_start_at: scheduledJob.scheduled_start_at,
          scheduled_end_at: scheduledJob.scheduled_end_at,
          scheduled_minutes: scheduledJob.scheduled_minutes,
          is_split_job: scheduledJob.is_split_job,
          split_job_part: scheduledJob.split_job_part,
          split_job_total_parts: scheduledJob.split_job_total_parts,
          scheduling_method: 'auto'
        })
        .eq('id', scheduledJob.instance_id);

      if (error) {
        console.error(`❌ Error updating job instance ${scheduledJob.instance_id}:`, error);
      } else {
        console.log(`✅ Updated scheduling for ${scheduledJob.stage_name} (${scheduledJob.split_job_part}/${scheduledJob.split_job_total_parts})`);
      }
    }
  }

  async scheduleAllJobs() {
    console.log('🚀 Container Scheduler: Starting scheduling for all active jobs...');
    
    const allJobs = await this.getAllActiveJobs();
    console.log(`📊 Found ${allJobs.length} active/pending job instances`);

    const scheduledJobs = this.scheduleJobsIntoContainers(allJobs);
    console.log(`📅 Created ${scheduledJobs.length} scheduled job entries`);

    // Update scheduling fields in database
    await this.updateSchedulingFields(scheduledJobs);

    const uniqueDays = new Set(scheduledJobs.map(job => job.container_day));
    const splitJobsCount = scheduledJobs.filter(job => job.is_split_job).length;

    return {
      total_jobs_scheduled: new Set(scheduledJobs.map(job => job.instance_id)).size,
      total_split_jobs: splitJobsCount,
      containers_used: uniqueDays.size,
      scheduling_start_date: this.BASE_SCHEDULE_DATE.toISOString(),
      scheduled_jobs: scheduledJobs
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

    const scheduler = new ContainerScheduler(supabaseClient);
    const results = await scheduler.scheduleAllJobs();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Container scheduling completed successfully',
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('❌ Container scheduler error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: 'Failed to run container scheduler'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})