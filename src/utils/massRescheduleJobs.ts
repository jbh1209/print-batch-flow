import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const massRescheduleAllJobs = async (): Promise<{
  processed: number;
  successful: number;
  failed: number;
  results: any[];
}> => {
  console.log('🔄 Starting mass reschedule of all jobs...');
  
  try {
    // Get all PROOF-completed jobs that need rescheduling
    const { data: jobsNeedingSchedule, error: fetchError } = await supabase
      .from('production_jobs')
      .select('id, wo_no, customer')
      .neq('status', 'Completed')
      .limit(100); // Process in batches for safety

    if (fetchError) {
      console.error('❌ Failed to fetch jobs:', fetchError);
      toast.error('Failed to fetch jobs for rescheduling');
      return { processed: 0, successful: 0, failed: 0, results: [] };
    }

    if (!jobsNeedingSchedule || jobsNeedingSchedule.length === 0) {
      console.log('📄 No jobs found for rescheduling');
      toast.info('No jobs found that need rescheduling');
      return { processed: 0, successful: 0, failed: 0, results: [] };
    }

    console.log(`📋 Found ${jobsNeedingSchedule.length} jobs to reschedule`);
    toast.info(`Starting reschedule of ${jobsNeedingSchedule.length} jobs...`);

    const results = [];
    let successful = 0;
    let failed = 0;

    // Process jobs one by one with the fixed scheduler
    for (const job of jobsNeedingSchedule) {
      try {
        console.log(`🚀 Rescheduling job ${job.wo_no} (${job.customer})`);
        
        // Call the fixed schedule-on-approval function
        const { data: scheduleResult, error: scheduleError } = await supabase.functions.invoke(
          'schedule-on-approval',
          {
            body: { 
              jobId: job.id,
              jobTableName: 'production_jobs'
            }
          }
        );

        if (scheduleError) {
          console.error(`❌ Failed to reschedule job ${job.wo_no}:`, scheduleError);
          failed++;
          results.push({
            jobId: job.id,
            woNo: job.wo_no,
            success: false,
            error: scheduleError.message
          });
        } else {
          console.log(`✅ Successfully rescheduled job ${job.wo_no}`);
          successful++;
          results.push({
            jobId: job.id,
            woNo: job.wo_no,
            success: true,
            result: scheduleResult
          });
        }

        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error rescheduling job ${job.wo_no}:`, error);
        failed++;
        results.push({
          jobId: job.id,
          woNo: job.wo_no,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const processed = successful + failed;
    
    console.log(`📊 Mass reschedule complete: ${processed} processed, ${successful} successful, ${failed} failed`);
    
    if (successful > 0) {
      toast.success(`Successfully rescheduled ${successful} jobs!`);
    }
    
    if (failed > 0) {
      toast.error(`Failed to reschedule ${failed} jobs`);
    }

    return {
      processed,
      successful,
      failed,
      results
    };

  } catch (error) {
    console.error('❌ Mass reschedule failed:', error);
    toast.error('Mass reschedule operation failed');
    return { processed: 0, successful: 0, failed: 0, results: [] };
  }
};