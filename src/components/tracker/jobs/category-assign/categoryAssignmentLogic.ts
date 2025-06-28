
import { toast } from "sonner";
import { batchAssignJobCategory } from "@/services/tracker/batchCategoryAssignmentService";

export const handleAssignment = async (
  job: any,
  selectedCategoryId: string,
  hasMultiPartStages: boolean,
  availableParts: string[],
  partAssignments: Record<string, string>,
  setIsAssigning: (value: boolean) => void,
  onAssign: () => void,
  onClose: () => void
) => {
  if (!selectedCategoryId) {
    toast.error("Please select a category");
    return;
  }

  try {
    setIsAssigning(true);
    console.log('🚀 Starting bulletproof category assignment...');
    
    const jobIds = job.isMultiple ? job.selectedIds : [job.id];
    const hasPartAssignments = hasMultiPartStages && Object.keys(partAssignments).length > 0;
    
    // Show user what we're about to do
    const jobCount = jobIds.length;
    const jobText = jobCount === 1 ? 'job' : 'jobs';
    const workflowType = hasPartAssignments ? 'multi-part workflow' : 'standard workflow';
    
    console.log(`📋 Processing ${jobCount} ${jobText} with ${workflowType}...`);
    
    const result = await batchAssignJobCategory(
      jobIds,
      selectedCategoryId,
      hasPartAssignments ? partAssignments : undefined
    );

    // Show detailed results to user
    if (result.successCount > 0) {
      const successMessage = hasPartAssignments
        ? `Successfully assigned category and initialized multi-part workflow for ${result.successCount} ${jobText}`
        : `Successfully assigned category and initialized workflow for ${result.successCount} ${jobText}`;
      
      toast.success(successMessage);
    }

    // Show any failures with details
    if (result.failedCount > 0) {
      const failureMessage = `Failed to assign category to ${result.failedCount} ${jobText}`;
      toast.error(failureMessage);
      
      // Log detailed errors for debugging
      result.errors.forEach(error => {
        console.error('❌ Category assignment error:', error);
      });
    }

    // Close modal and refresh data if we had any success
    if (result.successCount > 0) {
      onAssign();
      onClose();
    }

  } catch (error) {
    console.error('💥 Unexpected category assignment error:', error);
    toast.error('Failed to assign category - unexpected error occurred');
  } finally {
    setIsAssigning(false);
  }
};
