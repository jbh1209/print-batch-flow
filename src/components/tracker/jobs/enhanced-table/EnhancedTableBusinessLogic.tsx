
import { supabase } from "@/integrations/supabase/client";
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
      console.log(`🔧 Processing job ${job.id}...`, { categoryId: categoryId.substring(0, 8) });
      
      // Check if job already has workflow stages
      const { data: existingStages, error: stageCheckError } = await supabase
        .from('job_stage_instances')
        .select('id')
        .eq('job_id', job.id)
        .eq('job_table_name', 'production_jobs')
        .limit(1);

      if (stageCheckError) {
        throw new Error(`Stage check failed: ${stageCheckError.message}`);
      }

      if (existingStages && existingStages.length > 0) {
        console.log(`ℹ️ Job ${job.id} already has workflow stages`);
        return false; // Already assigned
      }

      const success = await repairJobWorkflow(job.id, 'production_jobs', categoryId);

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
