
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
    
    const jobIds = job.isMultiple ? job.selectedIds : [job.id];
    const hasPartAssignments = hasMultiPartStages && Object.keys(partAssignments).length > 0;
    
    const result = await batchAssignJobCategory(
      jobIds,
      selectedCategoryId,
      hasPartAssignments ? partAssignments : undefined
    );

    // Show results
    if (result.successCount > 0) {
      const message = hasPartAssignments
        ? `Successfully assigned category and initialized multi-part workflow for ${result.successCount} job(s)`
        : `Successfully assigned category and initialized workflow for ${result.successCount} job(s)`;
      
      toast.success(message);
    }

    if (result.failedCount > 0) {
      toast.error(`Failed to assign category to ${result.failedCount} job(s)`);
    }

    // Close modal and refresh data
    onAssign();
    onClose();

  } catch (error) {
    console.error('Category assignment error:', error);
    toast.error('Failed to assign category');
  } finally {
    setIsAssigning(false);
  }
};
