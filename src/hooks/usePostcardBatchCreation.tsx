
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { PostcardJob, PaperType, LaminationType } from '@/components/batches/types/PostcardTypes';
import { toast } from 'sonner';

export function usePostcardBatchCreation() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

  const createBatch = async (
    jobs: PostcardJob[],
    paperType: PaperType,
    laminationType: LaminationType
  ) => {
    if (!user || jobs.length === 0) return null;

    try {
      setIsCreatingBatch(true);

      // Find the earliest due date from all jobs
      const earliestDueDate = jobs.reduce((earliest, job) => {
        const jobDate = new Date(job.due_date);
        return !earliest || jobDate < earliest ? jobDate : earliest;
      }, null as Date | null);

      // Calculate total sheets required (simplified calculation for demo purposes)
      const totalSheets = Math.ceil(jobs.reduce((sum, job) => sum + job.quantity, 0) / 4);

      // Generate a unique batch name with timestamp
      const timestamp = Date.now().toString().slice(-6);
      const batchName = `DXB-PC-${timestamp}`;

      // Create the batch
      const { data: batchData, error: batchError } = await supabase
        .from('batches')
        .insert({
          name: batchName,
          status: 'pending',
          paper_type: paperType,
          lamination_type: laminationType,
          due_date: earliestDueDate?.toISOString() || new Date().toISOString(),
          sheets_required: totalSheets,
          created_by: user.id
        })
        .select()
        .single();

      if (batchError) throw batchError;

      // Update all jobs to be part of this batch
      const { error: updateError } = await supabase
        .from('postcard_jobs')
        .update({ 
          batch_id: batchData.id,
          status: 'batched'
        })
        .in('id', jobs.map(job => job.id));

      if (updateError) throw updateError;

      toast.success('Batch created successfully');
      return batchData.id;
    } catch (error) {
      console.error('Error creating batch:', error);
      toast.error('Failed to create batch');
      return null;
    } finally {
      setIsCreatingBatch(false);
    }
  };

  return {
    isCreatingBatch,
    createBatch
  };
}
