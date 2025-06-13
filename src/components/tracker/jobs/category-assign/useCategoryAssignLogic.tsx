import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validateUUIDArray } from "@/utils/uuidValidation";
import { useCategoryParts } from "@/hooks/tracker/useCategoryParts";
import { useWorkflowInitialization } from "@/hooks/tracker/useWorkflowInitialization";
import { handleAssignment } from "./categoryAssignmentLogic";

export const useCategoryAssignLogic = (job: any, onAssign: () => void, onClose: () => void) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<'category' | 'parts'>('category');
  const [partAssignments, setPartAssignments] = useState<Record<string, string>>({});
  const [isAssigning, setIsAssigning] = useState(false);
  const [orphanedJobs, setOrphanedJobs] = useState<string[]>([]);
  const [isCheckingWorkflow, setIsCheckingWorkflow] = useState(false);

  const { availableParts, multiPartStages, hasMultiPartStages, isLoading } = useCategoryParts(selectedCategoryId);
  const { repairJobWorkflow } = useWorkflowInitialization();

  const checkForOrphanedJobs = async (jobIds: string[]) => {
    try {
      setIsCheckingWorkflow(true);
      const orphaned = [];
      
      for (const jobId of jobIds) {
        const { data: job, error: jobError } = await supabase
          .from('production_jobs')
          .select('id, category_id')
          .eq('id', jobId)
          .single();

        if (jobError || !job) continue;

        if (job.category_id) {
          const { data: stages, error: stageError } = await supabase
            .from('job_stage_instances')
            .select('id')
            .eq('job_id', jobId)
            .eq('job_table_name', 'production_jobs')
            .limit(1);

          if (!stageError && (!stages || stages.length === 0)) {
            orphaned.push(jobId);
          }
        }
      }
      
      setOrphanedJobs(orphaned);
    } catch (error) {
      console.error('Error checking for orphaned jobs:', error);
    } finally {
      setIsCheckingWorkflow(false);
    }
  };

  useEffect(() => {
    if (job) {
      const jobIds = job.isMultiple ? job.selectedIds : [job.id];
      checkForOrphanedJobs(jobIds);
    }
  }, [job]);

  const handleRepairWorkflow = async () => {
    if (orphanedJobs.length === 0) return;

    try {
      setIsAssigning(true);
      let successCount = 0;

      for (const jobId of orphanedJobs) {
        const { data: jobData, error: jobError } = await supabase
          .from('production_jobs')
          .select('category_id')
          .eq('id', jobId)
          .single();

        if (jobError || !jobData || !jobData.category_id) {
          console.error('Failed to get job category for repair:', jobError);
          continue;
        }

        const success = await repairJobWorkflow(jobId, 'production_jobs', jobData.category_id);
        if (success) successCount++;
      }

      if (successCount > 0) {
        toast.success(`Repaired workflow for ${successCount} job(s)`);
        setOrphanedJobs([]);
        onAssign();
      }
    } catch (error) {
      console.error('Error repairing workflows:', error);
      toast.error('Failed to repair workflows');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    console.log('📝 Category selected:', categoryId);
    setSelectedCategoryId(categoryId);
    setPartAssignments({});
    setCurrentStep('category');
  };

  const handleNextStep = () => {
    if (!selectedCategoryId) {
      toast.error("Please select a category");
      return;
    }

    if (hasMultiPartStages && availableParts.length > 0) {
      console.log('✅ Moving to parts assignment step');
      setCurrentStep('parts');
    } else {
      console.log('⏭️ No multi-part stages, proceeding directly to assignment');
      handleAssignment(
        job,
        selectedCategoryId,
        hasMultiPartStages,
        availableParts,
        partAssignments,
        setIsAssigning,
        onAssign,
        onClose
      );
    }
  };

  const handlePartAssignmentsChange = (assignments: Record<string, string>) => {
    console.log('🔄 Part assignments changed:', assignments);
    setPartAssignments(assignments);
  };

  const handleBack = () => {
    setCurrentStep('category');
  };

  return {
    selectedCategoryId,
    currentStep,
    partAssignments,
    isAssigning,
    orphanedJobs,
    isCheckingWorkflow,
    availableParts,
    multiPartStages,
    hasMultiPartStages,
    isLoading,
    handleRepairWorkflow,
    handleCategorySelect,
    handleNextStep,
    handlePartAssignmentsChange,
    handleBack,
    setIsAssigning
  };
};
