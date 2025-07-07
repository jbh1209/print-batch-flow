import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AccessibleJob } from './useAccessibleJobs';

interface BatchAllocationDetectionResult {
  jobsInBatchAllocation: AccessibleJob[];
  jobsByCategory: Record<string, AccessibleJob[]>;
  isLoading: boolean;
  refreshJobs: () => void;
}

/**
 * Hook to detect and manage jobs that are in the Batch Allocation stage
 */
export const useBatchAllocationDetection = (): BatchAllocationDetectionResult => {
  const [jobsInBatchAllocation, setJobsInBatchAllocation] = useState<AccessibleJob[]>([]);
  const [jobsByCategory, setJobsByCategory] = useState<Record<string, AccessibleJob[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchBatchAllocationJobs = useCallback(async () => {
    try {
      setIsLoading(true);
      
      console.log('🔍 Fetching batch allocation jobs...');
      
      // Get jobs in Batch Allocation stage that are ready for batching
      const { data, error } = await supabase.rpc('get_user_accessible_jobs', {
        p_permission_type: 'work'
      });

      if (error) {
        console.error('❌ Error fetching batch allocation jobs:', error);
        return;
      }

      console.log(`📊 Total jobs from RPC: ${data?.length || 0}`);

      // Enhanced filtering with detailed logging
      const batchJobs = (data || []).filter((job: any) => {
        const isBatchAllocation = job.current_stage_name === 'Batch Allocation';
        const isActive = job.current_stage_status === 'active';
        
        const shouldInclude = isBatchAllocation && isActive;
        
        if (isBatchAllocation && !shouldInclude) {
          console.log(`⚠️ Job ${job.wo_no} in Batch Allocation but filtered out:`, {
            current_stage_name: job.current_stage_name,
            current_stage_status: job.current_stage_status,
            reason: !isActive ? 'Not active' : 'Unknown'
          });
        }
        
        return shouldInclude;
      });

      console.log(`✅ Filtered batch allocation jobs: ${batchJobs.length}`);

      const mappedJobs: AccessibleJob[] = batchJobs.map((job: any) => ({
        job_id: job.job_id,
        id: job.job_id,
        wo_no: job.wo_no,
        customer: job.customer,
        status: job.status,
        due_date: job.due_date,
        reference: job.reference,
        category_id: job.category_id,
        category_name: job.category_name,
        category_color: job.category_color,
        current_stage_id: job.current_stage_id,
        current_stage_name: job.current_stage_name,
        current_stage_color: job.current_stage_color,
        current_stage_status: job.current_stage_status,
        user_can_view: job.user_can_view,
        user_can_edit: job.user_can_edit,
        user_can_work: job.user_can_work,
        user_can_manage: job.user_can_manage,
        workflow_progress: job.workflow_progress,
        total_stages: job.total_stages,
        completed_stages: job.completed_stages,
        display_stage_name: job.display_stage_name,
        qty: job.qty,
        has_custom_workflow: false,
        manual_due_date: null,
        batch_category: job.batch_category,
        is_in_batch_processing: false,
        started_by: job.started_by,
        started_by_name: job.started_by_name,
        proof_emailed_at: job.proof_emailed_at
      }));

      setJobsInBatchAllocation(mappedJobs);

      // Group jobs by batch category for easier batch creation
      const groupedByCategory = mappedJobs.reduce((acc, job) => {
        const category = job.batch_category || 'uncategorized';
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(job);
        return acc;
      }, {} as Record<string, AccessibleJob[]>);

      setJobsByCategory(groupedByCategory);

      console.log(`✅ Found ${mappedJobs.length} jobs in Batch Allocation stage`);
      console.log('📋 Jobs by category:', Object.keys(groupedByCategory).map(cat => `${cat}: ${groupedByCategory[cat].length}`).join(', '));
      
    } catch (error) {
      console.error('❌ Error fetching batch allocation jobs:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBatchAllocationJobs();
  }, [fetchBatchAllocationJobs]);

  return {
    jobsInBatchAllocation,
    jobsByCategory,
    isLoading,
    refreshJobs: fetchBatchAllocationJobs
  };
};