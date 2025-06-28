
import { useState } from "react";
import { batchAssignJobCategory } from "@/services/tracker/batchCategoryAssignmentService";
import { toast } from "sonner";

export const useBulletproofCategoryAssignment = () => {
  const [isAssigning, setIsAssigning] = useState(false);

  const assignCategoryWithWorkflow = async (
    jobIds: string[],
    categoryId: string,
    partAssignments?: Record<string, string>
  ) => {
    setIsAssigning(true);

    try {
      console.log('🛡️ Starting bulletproof category assignment...', {
        jobCount: jobIds.length,
        categoryId: categoryId.substring(0, 8),
        hasPartAssignments: partAssignments && Object.keys(partAssignments).length > 0
      });

      const result = await batchAssignJobCategory(
        jobIds,
        categoryId,
        partAssignments
      );

      // Enhanced user feedback with detailed results
      const jobText = jobIds.length === 1 ? 'job' : 'jobs';
      
      if (result.successCount > 0) {
        const successMsg = partAssignments && Object.keys(partAssignments).length > 0
          ? `Successfully assigned category and initialized multi-part workflow for ${result.successCount} ${jobText}`
          : `Successfully assigned category and initialized workflow for ${result.successCount} ${jobText}`;
        
        toast.success(successMsg);
      }

      if (result.failedCount > 0) {
        toast.error(`Failed to assign category to ${result.failedCount} ${jobText}`);
        
        // Log detailed errors for debugging
        result.errors.forEach((error, index) => {
          console.error(`❌ Assignment error ${index + 1}:`, error);
        });
      }

      // Return success status
      return result.successCount > 0 && result.failedCount === 0;

    } catch (error) {
      console.error('💥 Bulletproof assignment error:', error);
      toast.error('Failed to assign categories - unexpected error');
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
