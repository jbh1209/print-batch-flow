import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const rescheduleAllProofCompletedJobs = async () => {
  console.log('🔄 Starting mass rescheduling for PROOF-completed jobs...');
  
  try {
    // Get all jobs that have completed PROOF but aren't scheduled
    const { data: jobs, error: jobsError } = await supabase
      .from('production_jobs')
      .select(`
        id, wo_no, customer,
        job_stage_instances!inner(
          production_stage_id,
          status,
          production_stages!inner(name)
        )
      `)
      .eq('job_stage_instances.production_stages.name', 'PROOF')
      .eq('job_stage_instances.status', 'completed');

    if (jobsError) {
      console.error('Error fetching jobs:', jobsError);
      toast.error('Failed to fetch jobs for rescheduling');
      return { success: false, error: jobsError.message };
    }

    if (!jobs || jobs.length === 0) {
      console.log('No jobs found that need rescheduling');
      toast.info('No jobs found that need rescheduling');
      return { success: true, processed: 0 };
    }

    console.log(`📋 Found ${jobs.length} jobs to reschedule`);
    toast.info(`Starting to reschedule ${jobs.length} jobs...`);

    let successful = 0;
    let failed = 0;
    const results = [];

    // Process each job through the new scheduler
    for (const job of jobs) {
      try {
        console.log(`🎯 Scheduling job ${job.wo_no} (${job.id})`);
        
        const { data: scheduleResult, error: scheduleError } = await supabase.functions.invoke(
          'schedule-on-approval',
          {
            body: {
              job_id: job.id,
              job_table_name: 'production_jobs'
            }
          }
        );

        if (scheduleError) {
          console.error(`❌ Failed to schedule job ${job.wo_no}:`, scheduleError);
          failed++;
          results.push({
            jobId: job.id,
            woNo: job.wo_no,
            success: false,
            error: scheduleError.message
          });
        } else if (scheduleResult?.ok) {
          console.log(`✅ Successfully scheduled job ${job.wo_no}`);
          successful++;
          results.push({
            jobId: job.id,
            woNo: job.wo_no,
            success: true,
            scheduled: scheduleResult.scheduled?.length || 0
          });
        } else {
          console.error(`❌ Scheduling failed for job ${job.wo_no}:`, scheduleResult?.error);
          failed++;
          results.push({
            jobId: job.id,
            woNo: job.wo_no,
            success: false,
            error: scheduleResult?.error || 'Unknown error'
          });
        }

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`💥 Unexpected error scheduling job ${job.wo_no}:`, error);
        failed++;
        results.push({
          jobId: job.id,
          woNo: job.wo_no,
          success: false,
          error: error instanceof Error ? error.message : 'Unexpected error'
        });
      }
    }

    const summary = {
      success: true,
      processed: jobs.length,
      successful,
      failed,
      results
    };

    console.log('📊 Mass rescheduling complete:', summary);
    
    if (successful > 0) {
      toast.success(`Successfully scheduled ${successful} jobs! ${failed > 0 ? `(${failed} failed)` : ''}`);
    } else {
      toast.error(`Failed to schedule any jobs. ${failed} failures.`);
    }

    return summary;

  } catch (error) {
    console.error('💥 Mass rescheduling failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    toast.error(`Mass rescheduling failed: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
};