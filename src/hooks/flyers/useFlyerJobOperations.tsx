
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { FlyerJob } from '@/components/batches/types/FlyerTypes';
import { toast } from 'sonner';

export function useFlyerJobOperations() {
  const { user } = useAuth();

  const deleteJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('flyer_jobs')
        .delete()
        .eq('id', jobId)
        .eq('user_id', user?.id);

      if (error) throw error;

      return true;
    } catch (err) {
      console.error('Error deleting flyer job:', err);
      throw err;
    }
  };

  // Add the createJob method
  const createJob = async (jobData: Omit<FlyerJob, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'batch_id'>) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const newJob = {
        ...jobData,
        user_id: user.id,
        status: 'queued' as const
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
  };

  return {
    deleteJob,
    createJob,
  };
}
