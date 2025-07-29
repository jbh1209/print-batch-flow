import { supabase } from "@/integrations/supabase/client";
import { addWorkingDays } from "@/utils/tracker/workingDayCalculations";

interface SimpleDueDateResult {
  dueDate: string;
  totalEstimatedMinutes: number;
  dtpMinutes: number;
  proofingMinutes: number;
  bufferDays: number;
}

/**
 * Simple due date calculator for immediate results during job creation
 * Uses pre-calculated stage durations + fixed DTP/Proofing times + buffer
 * Does NOT use complex queue calculations (those happen after proof approval)
 */
export class SimpleDueDateCalculator {
  private static readonly DTP_MINUTES = 10;
  private static readonly PROOFING_MINUTES = 8 * 60; // 8 hours ideal proofing time
  private static readonly BUFFER_DAYS = 1;

  /**
   * Calculate immediate due date for new job
   * Assumes ideal scenario: DTP (10min) + Proofing (8hrs) + stage durations + 1 day buffer
   */
  static async calculateImmediateDueDate(jobId: string): Promise<SimpleDueDateResult> {
    try {
      // Get all stage instances with their estimated durations
      const { data: stageInstances, error } = await supabase
        .from('job_stage_instances')
        .select('estimated_duration_minutes')
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs');

      if (error) {
        console.error('Error fetching stage instances for due date calculation:', error);
        return this.getFallbackDueDate();
      }

      // Sum all stage durations
      const totalStageMinutes = stageInstances?.reduce((sum, stage) => {
        return sum + (stage.estimated_duration_minutes || 0);
      }, 0) || 0;

      // Total time = DTP + Proofing + Stage work
      const totalMinutes = this.DTP_MINUTES + this.PROOFING_MINUTES + totalStageMinutes;
      
      // Convert to working days (8 hours = 480 minutes per day)
      const totalWorkingDays = Math.ceil(totalMinutes / 480);
      
      // Calculate due date: today + working days + buffer
      const today = new Date();
      const dueDate = addWorkingDays(today, totalWorkingDays + this.BUFFER_DAYS);

      console.log(`📅 Simple due date calculated for job ${jobId}:`);
      console.log(`   DTP: ${this.DTP_MINUTES} min, Proofing: ${this.PROOFING_MINUTES} min`);
      console.log(`   Stage work: ${totalStageMinutes} min (${stageInstances?.length || 0} stages)`);
      console.log(`   Total: ${totalMinutes} min = ${totalWorkingDays} working days`);
      console.log(`   Due date (with ${this.BUFFER_DAYS} day buffer): ${dueDate.toDateString()}`);

      return {
        dueDate: dueDate.toISOString().split('T')[0],
        totalEstimatedMinutes: totalMinutes,
        dtpMinutes: this.DTP_MINUTES,
        proofingMinutes: this.PROOFING_MINUTES,
        bufferDays: this.BUFFER_DAYS
      };

    } catch (error) {
      console.error('Error in simple due date calculation:', error);
      return this.getFallbackDueDate();
    }
  }

  /**
   * Fallback due date calculation (3 working days + buffer)
   */
  private static getFallbackDueDate(): SimpleDueDateResult {
    const today = new Date();
    const dueDate = addWorkingDays(today, 3 + this.BUFFER_DAYS);
    
    return {
      dueDate: dueDate.toISOString().split('T')[0],
      totalEstimatedMinutes: 3 * 480, // 3 days * 8 hours * 60 minutes
      dtpMinutes: this.DTP_MINUTES,
      proofingMinutes: this.PROOFING_MINUTES,
      bufferDays: this.BUFFER_DAYS
    };
  }

  /**
   * Update job with calculated due date
   */
  static async updateJobDueDate(jobId: string): Promise<boolean> {
    try {
      const result = await this.calculateImmediateDueDate(jobId);
      
      const { error } = await supabase
        .from('production_jobs')
        .update({
          due_date: result.dueDate,
          due_date_buffer_days: result.bufferDays,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (error) {
        console.error('Error updating job due date:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateJobDueDate:', error);
      return false;
    }
  }
}