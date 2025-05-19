
import { useState } from 'react';
import { useFlyerJobs } from '@/hooks/useFlyerJobs';
import { FlyerJob, LaminationType } from '@/components/batches/types/FlyerTypes';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { productConfigs } from '@/config/productTypes';

/**
 * Custom hook for handling direct flyer batch creation without dialogs
 */
export function useFlyerJobsBatchDirect() {
  const navigate = useNavigate();
  const { createBatch, isCreatingBatch, fetchJobs } = useFlyerJobs();
  
  // Function to create a batch directly with selected jobs
  const createBatchDirect = async (selectedJobs: FlyerJob[]) => {
    if (selectedJobs.length === 0) {
      toast.error("Please select at least one job to create a batch");
      return;
    }
    
    try {
      // Get the flyers config for default values
      const flyersConfig = productConfigs["Flyers"];
      
      // Determine common properties from selected jobs
      const commonPaperType = findCommonProperty(selectedJobs, 'paper_type');
      const commonPaperWeight = findCommonProperty(selectedJobs, 'paper_weight');
      
      // Show creating batch toast
      toast.loading("Creating batch with " + selectedJobs.length + " jobs...");
      
      // Create the batch with automatically determined properties
      const batch = await createBatch(selectedJobs, {
        // Use common properties when available, otherwise use defaults from config
        paperType: commonPaperType || flyersConfig.availablePaperTypes[0],
        paperWeight: commonPaperWeight || flyersConfig.availablePaperWeights[0],
        laminationType: "none",
        printerType: "HP 12000",
        sheetSize: "530x750mm",
        slaTargetDays: flyersConfig.slaTargetDays
      });
      
      // Clear and refresh jobs list
      await fetchJobs();
      
      // Dismiss loading toast and show success message with the batch name
      toast.dismiss();
      toast.success(`Batch ${batch.name} created with ${selectedJobs.length} jobs`);
      
      // Navigate to the newly created batch details
      navigate(`/batches/flyers/batches/${batch.id}`);
      
      return batch;
    } catch (error) {
      console.error("Error creating batch:", error);
      toast.dismiss();
      toast.error("Failed to create batch. Please try again.");
      throw error;
    }
  };
  
  // Helper function to find common property among jobs
  const findCommonProperty = (jobs: FlyerJob[], property: keyof FlyerJob): string | null => {
    if (jobs.length === 0) return null;
    
    const firstValue = jobs[0][property];
    const allSame = jobs.every(job => job[property] === firstValue);
    
    return allSame ? String(firstValue) : null;
  };

  return {
    createBatchDirect,
    isCreatingBatch
  };
}
