
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
    
    const finalDecision = isAccessible;

    console.log(`  Decision for ${job.wo_no}: ${finalDecision ? '✅ INCLUDED' : '❌ EXCLUDED'}`, {
      isAccessible,
      accessReasons,
      displayStage: job.display_stage_name,
      currentStage: job.current_stage_name
    });

    // Apply base accessibility filters
    if (!finalDecision) {
      return false;
    }

    // Apply additional user filters
    if (statusFilter && statusFilter !== 'completed' && job.status !== statusFilter) {
      return false;
    }

    if (categoryFilter && job.category_name?.toLowerCase() !== categoryFilter.toLowerCase()) {
      return false;
    }

    // Use display_stage_name for filtering (master queue aware), fallback to current_stage_name
    const stageNameForFiltering = job.display_stage_name || job.current_stage_name;
    if (stageFilter && stageNameForFiltering?.toLowerCase() !== stageFilter.toLowerCase()) {
      return false;
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const searchFields = [
        job.wo_no,
        job.customer,
        job.reference,
        job.category_name,
        job.status,
        job.current_stage_name,
        job.display_stage_name // Include display stage name in search
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
