
import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useEnhancedTableBusinessLogic = (normalizedJobs: any[], refreshJobs: () => void) => {
  const handleEditJob = (job: any) => {
    return job;
  };

  const handleCategoryAssign = (job: any) => {
    console.log('🔍 EnhancedJobsTable - Single Category Assign:', {
      jobId: job.id,
      jobStructure: job
    });
    return job;
  };

  const handleCustomWorkflowFromTable = (job: any) => {
    return job;
  };

  const handleBulkCategoryAssign = (selectedJobs: string[]) => {
    if (selectedJobs.length > 0) {
      const jobIds = selectedJobs.filter(Boolean);
      
      console.log('🔍 Enhanced Table - Bulk Category Assign:', {
        selectedJobs,
        jobIds,
        selectedJobsType: selectedJobs.map(j => typeof j)
      });

      const firstJob = normalizedJobs.find(job => job.id === selectedJobs[0]);
      if (firstJob) {
        return {
          ...firstJob,
          isMultiple: true,
          selectedIds: jobIds
        };
      } else {
        console.error('❌ Could not find first job for bulk assignment');
        toast.error('Cannot assign category: Selected job not found');
        return null;
      }
    }
    return null;
  };

  const handleCustomWorkflow = (selectedJobs: string[]) => {
    if (selectedJobs.length !== 1) {
      toast.error("Custom workflows can only be created for individual jobs");
      return null;
    }
    const selectedJob = normalizedJobs.find(job => job.id === selectedJobs[0]);
    return selectedJob || null;
  };

  const handleDeleteSingleJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('production_jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;

      toast.success('Job deleted successfully');
      refreshJobs();
      
      return true;
    } catch (err) {
      console.error('Error deleting job:', err);
      toast.error('Failed to delete job');
      return false;
    }
  };

  return {
    handleEditJob,
    handleCategoryAssign,
    handleCustomWorkflowFromTable,
    handleBulkCategoryAssign,
    handleCustomWorkflow,
    handleDeleteSingleJob
  };
};
