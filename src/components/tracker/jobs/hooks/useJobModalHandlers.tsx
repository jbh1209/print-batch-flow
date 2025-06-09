
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useJobModalHandlers = (
  refreshJobs: () => void,
  setEditingJob: (job: any) => void,
  setCategoryAssignJob: (job: any) => void,
  setWorkflowInitJob: (job: any) => void,
  selectedJobs: any[],
  setSelectedJobs: (jobs: any[]) => void
) => {
  const handleCategoryAssign = useCallback((job?: any) => {
    if (job) {
      // Single job assignment - validate job has ID
      console.log('🔍 useJobModalHandlers - Single Category Assign:', {
        jobId: job.id,
        jobType: typeof job,
        jobStructure: job
      });
      
      if (!job.id) {
        console.error('❌ Job missing ID in handleCategoryAssign:', job);
        toast.error('Cannot assign category: Job ID is missing');
        return;
      }
      
      setCategoryAssignJob(job);
    } else if (selectedJobs.length > 0) {
      // Bulk category assignment - use first job for modal
      setCategoryAssignJob(selectedJobs[0]);
    }
  }, [selectedJobs, setCategoryAssignJob]);

  const handleEditJob = useCallback((job: any) => {
    setEditingJob(job);
  }, [setEditingJob]);

  const handleWorkflowInit = useCallback((job: any) => {
    setWorkflowInitJob(job);
  }, [setWorkflowInitJob]);

  const handleWorkflowInitialize = useCallback(async (job: any, categoryId: string) => {
    try {
      const { error } = await supabase
        .from('production_jobs')
        .update({ 
          category_id: categoryId,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);

      if (error) throw error;

      toast.success('Workflow initialized successfully');
      setWorkflowInitJob(null);
      refreshJobs();
    } catch (err) {
      console.error('Error initializing workflow:', err);
      toast.error('Failed to initialize workflow');
    }
  }, [refreshJobs, setWorkflowInitJob]);

  const handleCategoryAssignComplete = useCallback(() => {
    setCategoryAssignJob(null);
    refreshJobs();
    setSelectedJobs([]);
  }, [setCategoryAssignJob, refreshJobs, setSelectedJobs]);

  const handleEditJobSave = useCallback(() => {
    setEditingJob(null);
    refreshJobs();
  }, [setEditingJob, refreshJobs]);

  const handleBulkCategoryAssign = useCallback(() => {
    if (selectedJobs.length > 0) {
      // Extract job IDs properly - handle both string and object cases
      const jobIds = selectedJobs.map(job => {
        if (typeof job === 'string') {
          return job; // Already a job ID
        }
        // If it's an object, extract the ID
        return job.id || job.job_id;
      }).filter(Boolean); // Remove any undefined values

      console.log('🔍 Bulk Category Assign - Job IDs:', jobIds);
      console.log('🔍 Selected Jobs Type Check:', selectedJobs.map(j => typeof j));

      const firstJob = selectedJobs[0];
      if (firstJob && (typeof firstJob === 'object')) {
        // Ensure we have a proper job object with ID
        const jobWithId = {
          ...firstJob,
          id: firstJob.id || firstJob.job_id, // Ensure ID is present
          isMultiple: true,
          selectedIds: jobIds // Use properly extracted job IDs
        };
        
        if (!jobWithId.id) {
          console.error('❌ First job missing ID in bulk assignment:', firstJob);
          toast.error('Cannot assign category: Job ID is missing');
          return;
        }
        
        setCategoryAssignJob(jobWithId);
      } else {
        console.error('❌ Invalid first job in bulk assignment:', firstJob);
        toast.error('Cannot assign category: Invalid job selection');
      }
    }
  }, [selectedJobs, setCategoryAssignJob]);

  return {
    handleCategoryAssign,
    handleEditJob,
    handleWorkflowInit,
    handleWorkflowInitialize,
    handleCategoryAssignComplete,
    handleEditJobSave,
    handleBulkCategoryAssign
  };
};
