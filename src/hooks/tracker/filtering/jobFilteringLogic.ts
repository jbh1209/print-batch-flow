
import { checkJobAccess } from './jobAccessChecker';
import { isJobCompleted } from '@/utils/tracker/jobCompletionUtils';

export const applyJobFilters = (
  jobs: any[],
  accessibleStageIds: string[],
  accessibleStageNames: string[],
  statusFilter?: string | null,
  searchQuery?: string,
  categoryFilter?: string | null,
  stageFilter?: string | null
): any[] => {
  return jobs.filter(job => {
    const { isAccessible, accessReasons } = checkJobAccess(job, accessibleStageIds, accessibleStageNames);
    
    // Note: Completion filtering is now handled at a higher level in useUnifiedJobFiltering
    // This function assumes jobs are already filtered for completion status as needed

    const finalDecision = isAccessible;

    console.log(`  Decision for ${job.wo_no}: ${finalDecision ? '✅ INCLUDED' : '❌ EXCLUDED'}`, {
      isAccessible,
      accessReasons
    });

    // Apply base accessibility filters
    if (!finalDecision) {
      return false;
    }

    // Apply additional user filters
    if (statusFilter && statusFilter !== 'completed' && job.status !== statusFilter) {
      return false;
    }

    if (categoryFilter && job.category?.toLowerCase() !== categoryFilter.toLowerCase()) {
      return false;
    }

    if (stageFilter && job.current_stage?.toLowerCase() !== stageFilter.toLowerCase()) {
      return false;
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const searchFields = [
        job.wo_no,
        job.customer,
        job.reference,
        job.category,
        job.status,
        job.current_stage
      ].filter(Boolean);

      const matchesSearch = searchFields.some(field => 
        field?.toLowerCase().includes(query)
      );

      if (!matchesSearch) {
        return false;
      }
    }

    return true;
  });
};
