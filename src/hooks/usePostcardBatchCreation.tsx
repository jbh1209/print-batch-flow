
import { useState } from 'react';
import { usePostcardJobs } from './usePostcardJobs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PostcardJob, LaminationType } from "@/components/batches/types/PostcardTypes";

export function usePostcardBatchCreation() {
  const { jobs, fetchJobs } = usePostcardJobs();
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

  // Batch creation for postcards (mirroring Flyers logic)
  const createBatch = async (selectedJobs: PostcardJob[], paperType: string, laminationType: string) => {
    if (selectedJobs.length === 0) {
      toast.error("No jobs selected for batch");
      return null;
    }
    setIsCreatingBatch(true);
    try {
      // Sheets calculation: (1 sheet = 2 postcards), just a placeholder formula, adjust as needed
      const totalQuantity = selectedJobs.reduce((acc, job) => acc + (job.quantity || 0), 0);
      const sheetsRequired = Math.ceil(totalQuantity / 2);

      // Batch number
      const batchNumber = await generateBatchNumber();

      // Cast laminationType to valid type to satisfy TypeScript
      // This ensures the value is one of the allowed types for the database
      const validLaminationType = validateLaminationType(laminationType);

      // Create the batch
      const { data: batchData, error: batchError } = await supabase
        .from('batches')
        .insert({
          name: batchNumber,
          paper_type: paperType,
          lamination_type: validLaminationType,
          due_date: new Date().toISOString(),
          printer_type: "HP 12000",
          sheet_size: "530x750mm",
          sheets_required: sheetsRequired,
          created_by: selectedJobs[0].user_id,
          status: 'pending'
        })
        .select()
        .single();

      if (batchError) throw batchError;

      // Mark jobs as batched
      const jobIds = selectedJobs.map(j => j.id);
      const { error: updateError } = await supabase
        .from('postcard_jobs')
        .update({
          batch_id: batchData.id,
          status: 'batched'
        })
        .in('id', jobIds);

      if (updateError) throw updateError;

      toast.success(`Batch ${batchNumber} created!`);
      await fetchJobs();
      return batchData;
    } catch (err) {
      console.error("Error creating postcard batch:", err);
      toast.error("Failed to create batch");
      return null;
    } finally {
      setIsCreatingBatch(false);
    }
  };

  // Helper function to validate lamination type
  const validateLaminationType = (type: string): LaminationType => {
    const validTypes: LaminationType[] = ["gloss", "matt", "soft_touch", "none"];
    if (validTypes.includes(type as LaminationType)) {
      return type as LaminationType;
    }
    // Default to "none" if invalid type provided
    console.warn(`Invalid lamination type: ${type}, defaulting to "none"`);
    return "none";
  };

  // DXB-PC-00001 format (paralleling flyers)
  const generateBatchNumber = async (): Promise<string> => {
    const { data, error } = await supabase
      .from('batches')
      .select('name')
      .filter('name', 'ilike', 'DXB-PC-%');
    if (error) return `DXB-PC-${Date.now()}`;
    const batchCount = (data?.length || 0) + 1;
    return `DXB-PC-${batchCount.toString().padStart(5, '0')}`;
  };

  return {
    jobs,
    isCreatingBatch,
    createBatch
  };
}
