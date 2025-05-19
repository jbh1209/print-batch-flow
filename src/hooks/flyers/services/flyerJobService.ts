
import { supabase } from '@/integrations/supabase/client';
import { FlyerJob } from '@/components/batches/types/FlyerTypes';

/**
 * Service for handling basic flyer job operations
 */
export const FlyerJobService = {
  /**
   * Deletes a flyer job by ID
   */
  async deleteJob(jobId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('flyer_jobs')
        .delete()
        .eq('id', jobId)
        .eq('user_id', userId);

      if (error) throw error;

      return true;
    } catch (err) {
      console.error('Error deleting flyer job:', err);
      throw err;
    }
  },

  /**
   * Creates a new flyer job
   */
  async createJob(
    jobData: Omit<FlyerJob, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'batch_id'>,
    userId: string
  ): Promise<FlyerJob> {
    try {
      const newJob = {
        ...jobData,
        user_id: userId,
        status: 'queued' as const,
        batch_id: null
      };

      const { data, error } = await supabase
        .from('flyer_jobs')
        .insert(newJob)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (err) {
      console.error('Error creating flyer job:', err);
      throw err;
    }
  }
};
