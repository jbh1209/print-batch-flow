
import { toast } from "sonner";
import { assignJobCategory, CategoryAssignmentResult } from "@/services/tracker/categoryAssignmentService";

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
    console.log('🎯 Starting category assignment process with proper ordering:', {
      selectedCategoryId,
      hasMultiPartStages,
      availableParts,
      partAssignments,
      isMultiple: job.isMultiple
    });

    const jobIds = job.isMultiple ? job.selectedIds : [job.id];
    let successCount = 0;
    let alreadyAssignedCount = 0;
    
    for (const jobId of jobIds) {
      try {
        const result = await assignJobCategory(
          jobId,
          selectedCategoryId,
          hasMultiPartStages,
          partAssignments
        );

        if (result) {
          successCount++;
        } else {
          alreadyAssignedCount++;
        }
      } catch (error) {
        console.error(`❌ Assignment failed for job ${jobId}:`, error);
        toast.error(`Failed to assign job ${jobId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Show appropriate success/warning messages
    if (successCount > 0) {
      const message = hasMultiPartStages && Object.keys(partAssignments).length > 0
        ? `Successfully assigned category and initialized multi-part workflow for ${successCount} job(s) - all stages are PENDING and ordered by WO number`
        : `Successfully assigned category and initialized workflow for ${successCount} job(s) - all stages are PENDING and ordered by WO number`;
      
      toast.success(message);
    }

    if (alreadyAssignedCount > 0) {
      toast.warning(`${alreadyAssignedCount} job(s) already have workflow stages and were skipped`);
    }

    if (successCount === 0 && alreadyAssignedCount === 0) {
      toast.error('Failed to assign category to any jobs');
    }

    // Close modal and refresh data
    onAssign();
    onClose();

  } catch (error) {
    console.error('❌ Error in category assignment:', error);
    toast.error('Failed to assign category');
  } finally {
    setIsAssigning(false);
  }
};
