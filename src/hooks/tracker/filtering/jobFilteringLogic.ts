import { checkJobAccess, isJobCompleted } from './jobAccessChecker';

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
    
    // Filter out completed jobs from production queues (but keep them in system for duplicate prevention)
    const isNotCompleted = !isJobCompleted(job) && job.status !== 'Completed';

    const finalDecision = isAccessible && isNotCompleted;

    console.log(`  Decision for ${job.wo_no}: ${finalDecision ? '✅ INCLUDED' : '❌ EXCLUDED'}`, {
      isAccessible,
      isNotCompleted,
      status: job.status,
      accessReasons
    });

    // Apply base accessibility and completion filters
    if (!finalDecision) {
      return false;
    }

    // Apply additional user filters
    if (statusFilter && job.status?.toLowerCase() !== statusFilter.toLowerCase()) {
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
