
import { useState } from "react";
import { batchAssignJobCategory } from "@/services/tracker/batchCategoryAssignmentService";
import { toast } from "sonner";

export const useAtomicCategoryAssignment = () => {
  const [isAssigning, setIsAssigning] = useState(false);

  const assignCategoryWithWorkflow = async (
    jobIds: string[],
    categoryId: string,
    partAssignments?: Record<string, string>,
    currentJobCategoryId?: string | null
  ) => {
    setIsAssigning(true);

    try {
      const result = await batchAssignJobCategory(
        jobIds,
        categoryId,
        partAssignments
      );

      // Show user feedback
      if (result.successCount > 0) {
        toast.success(`Successfully assigned category to ${result.successCount} out of ${result.totalCount} job(s)`);
      }

      if (result.failedCount > 0) {
        toast.error(`Failed to assign category to ${result.failedCount} job(s)`);
      }

      return result.successCount > 0 && result.failedCount === 0;

    } catch (error) {
      console.error('Atomic assignment error:', error);
      toast.error('Failed to assign categories');
      return false;
    } finally {
      setIsAssigning(false);
    }
  };

  return {
    assignCategoryWithWorkflow,
    isAssigning
  };
};
