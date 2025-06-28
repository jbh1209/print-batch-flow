
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
      console.log('🔒 Starting atomic category assignment with force-reset...', {
        jobCount: jobIds.length,
        categoryId: categoryId.substring(0, 8),
        hasPartAssignments: partAssignments && Object.keys(partAssignments).length > 0,
        previousCategoryId: currentJobCategoryId?.substring(0, 8)
      });

      const result = await batchAssignJobCategory(
        jobIds,
        categoryId,
        partAssignments
      );

      // Show user feedback with detailed results
      if (result.successCount > 0) {
        const jobText = result.totalCount === 1 ? 'job' : 'jobs';
        toast.success(`Successfully assigned category to ${result.successCount} out of ${result.totalCount} ${jobText}`);
      }

      if (result.failedCount > 0) {
        const failedText = result.failedCount === 1 ? 'job' : 'jobs';
        toast.error(`Failed to assign category to ${result.failedCount} ${failedText}`);
        
        // Log errors for debugging
        console.group('🔍 Category Assignment Errors:');
        result.errors.forEach(error => {
          console.error(error);
        });
        console.groupEnd();
      }

      return result.successCount > 0 && result.failedCount === 0;

    } catch (error) {
      console.error('💥 Atomic assignment error:', error);
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
