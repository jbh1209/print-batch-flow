
import { toast } from "sonner";
import { useWorkflowInitialization } from "@/hooks/tracker/useWorkflowInitialization";

export const useEnhancedTableBusinessLogic = (
  normalizedJobs: any[],
  refreshJobs: () => void
) => {
  const { 
    initializeWorkflow, 
    initializeCustomWorkflowWithStages,
    repairJobWorkflow,
    isInitializing 
  } = useWorkflowInitialization();

  const handleEditJob = (job: any) => {
    console.log('📝 Opening job for editing:', job.wo_no);
    return job;
  };

  const handleCategoryAssign = (job: any) => {
    console.log('🏷️ Opening category assignment for job:', job.wo_no);
    return job;
  };

  const handleCustomWorkflowFromTable = (job: any) => {
    console.log('🔧 Opening custom workflow for job:', job.wo_no);
    return job;
  };

  const handleBulkCategoryAssign = (selectedJobIds: string[]) => {
    if (selectedJobIds.length === 0) {
      toast.error('No jobs selected for category assignment');
      return null;
    }

    console.log('🏷️ Opening bulk category assignment for jobs:', selectedJobIds.length);
    
    // For bulk operations, we return a special object indicating bulk mode
    return {
      isBulk: true,
      jobIds: selectedJobIds,
      jobs: normalizedJobs.filter(job => selectedJobIds.includes(job.id))
    };
  };

  const handleCustomWorkflow = (selectedJobIds: string[]) => {
    if (selectedJobIds.length === 0) {
      toast.error('No jobs selected for custom workflow');
      return null;
    }

    console.log('🔧 Opening custom workflow for selected jobs:', selectedJobIds.length);
    
    return {
      isBulk: true,
      jobIds: selectedJobIds,
      jobs: normalizedJobs.filter(job => selectedJobIds.includes(job.id))
    };
  };

  const handleDeleteSingleJob = async (jobId: string): Promise<boolean> => {
    console.log('🗑️ Attempting to delete job:', jobId);
    
    try {
      // Implementation would depend on your delete job logic
      // For now, just show a warning
      toast.error('Job deletion not implemented yet');
      return false;
    } catch (error) {
      console.error('❌ Error deleting job:', error);
      toast.error('Failed to delete job');
      return false;
    }
  };

  const handleCategoryAssignmentComplete = async (
    job: any, 
    categoryId: string, 
    partAssignments?: Record<string, string>
  ): Promise<boolean> => {
    try {
      console.log('🔄 Completing category assignment...', { 
        jobId: job.id, 
        categoryId, 
        partAssignments 
      });

      // Check if the job already has a category and stages
      const hasExistingCategory = job.category_id === categoryId;
      const hasStages = job.current_stage_id && job.current_stage_id !== '00000000-0000-0000-0000-000000000000';

      if (hasExistingCategory && hasStages) {
        console.log('ℹ️ Job already has this category and workflow stages');
        toast.info('Job already has this category assigned with active workflow');
        return true;
      }

      // If job has the category but no stages, repair the workflow
      if (hasExistingCategory && !hasStages) {
        console.log('🔧 Job has category but no stages - repairing workflow');
        const success = await repairJobWorkflow(job.id, 'production_jobs', categoryId);
        if (success) {
          refreshJobs();
        }
        return success;
      }

      // Initialize workflow based on whether part assignments are provided
      let success: boolean;
      if (partAssignments && Object.keys(partAssignments).length > 0) {
        success = await initializeWorkflow(job.id, 'production_jobs', selectedCategoryId);
      } else {
        success = await initializeWorkflow(job.id, 'production_jobs', categoryId);
      }

      if (success) {
        console.log('✅ Category assignment and workflow initialization completed');
        refreshJobs();
      }

      return success;
    } catch (error) {
      console.error('❌ Error in category assignment completion:', error);
      toast.error('Failed to complete category assignment');
      return false;
    }
  };

  return {
    handleEditJob,
    handleCategoryAssign,
    handleCustomWorkflowFromTable,
    handleBulkCategoryAssign,
    handleCustomWorkflow,
    handleDeleteSingleJob,
    handleCategoryAssignmentComplete,
    isInitializing
  };
};
