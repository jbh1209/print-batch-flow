import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface JobStageInstance {
  id: string;
  job_id: string;
  job_table_name: string;
  category_id: string | null;
  production_stage_id: string;
  stage_order: number;
  status: 'pending' | 'active' | 'completed' | 'reworked';
  started_at: string | null;
  completed_at: string | null;
  started_by: string | null;
  completed_by: string | null;
  notes: string | null;
  part_name: string | null;
  part_order?: number | null;
  printer_id: string | null;
  qr_scan_data: any;
  rework_count: number | null;
  rework_reason: string | null;
  previous_stage_id: string | null;
  is_rework: boolean | null;
  proof_emailed_at: string | null;
  proof_approved_manually_at: string | null;
  client_email: string | null;
  client_name: string | null;
  proof_pdf_url: string | null;
  job_order_in_stage: number;
  created_at: string;
  updated_at: string;
  production_stage: {
    id: string;
    name: string;
    description: string;
    color: string;
    is_multi_part: boolean;
    part_definitions: any;
  };
  production_job?: {
    id: string;
    wo_no: string;
    customer: string;
    due_date: string;
  };
}

interface JobStageInstancesResult {
  instances: JobStageInstance[];
  isLoading: boolean;
  error: string | null;
  refreshInstances: () => Promise<void>;
}

export const useJobStageInstances = (
  jobIds: string[],
  jobTableName: string = 'production_jobs'
): JobStageInstancesResult => {
  const [instances, setInstances] = useState<JobStageInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInstances = useCallback(async () => {
    if (jobIds.length === 0) {
      setInstances([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔄 Fetching job stage instances...', { jobIds: jobIds.length, jobTableName });
      
      const { data, error } = await supabase
        .from('job_stage_instances')
        .select(`
          *,
          production_stages (
            id,
            name,
            description,
            color
          )
        `)
        .in('job_id', jobIds)
        .eq('job_table_name', jobTableName)
        .order('stage_order');

      if (error) {
        console.error('❌ Job stage instances fetch error:', error);
        throw new Error(`Failed to fetch job stage instances: ${error.message}`);
      }

      console.log('✅ Job stage instances fetched successfully:', data?.length || 0);
      
      // Clean mapping with proper Supabase relationship inference
      const typedData: JobStageInstance[] = (data || []).map(item => ({
        ...item,
        status: item.status as 'pending' | 'active' | 'completed' | 'reworked',
        part_order: null, // Always null for sequential workflow
        production_stage: {
          id: item.production_stages?.id ?? '',
          name: item.production_stages?.name ?? 'Unknown',
          description: item.production_stages?.description ?? '',
          color: item.production_stages?.color ?? '#6B7280',
          is_multi_part: false, // Sequential workflow only
          part_definitions: [] // Sequential workflow only
        },
        production_job: undefined // Will be populated separately if needed
      }));

      setInstances(typedData);
    } catch (err) {
      console.error('❌ Error fetching job stage instances:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load job stage instances';
      setError(errorMessage);
      toast.error('Failed to load job stage instances');
    } finally {
      setIsLoading(false);
    }
  }, [jobIds, jobTableName]);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  const refreshInstances = useCallback(async () => {
    await fetchInstances();
  }, [fetchInstances]);

  return {
    instances,
    isLoading,
    error,
    refreshInstances
  };
};

// Utility hook for getting instances for a single job
export const useJobStageInstancesForJob = (
  jobId: string,
  jobTableName: string = 'production_jobs'
): JobStageInstancesResult => {
  return useJobStageInstances([jobId], jobTableName);
};

// Utility hook for managing stage status updates
export const useStageStatusUpdate = () => {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateStageStatus = useCallback(async (
    stageInstanceId: string,
    newStatus: 'pending' | 'active' | 'completed' | 'reworked',
    notes?: string
  ): Promise<boolean> => {
    try {
      setIsUpdating(true);
      
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (newStatus === 'active') {
        updateData.started_at = new Date().toISOString();
        updateData.started_by = (await supabase.auth.getUser()).data.user?.id;
      } else if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = (await supabase.auth.getUser()).data.user?.id;
      }

      if (notes) {
        updateData.notes = notes;
      }

      const { error } = await supabase
        .from('job_stage_instances')
        .update(updateData)
        .eq('id', stageInstanceId);

      if (error) {
        console.error('❌ Error updating stage status:', error);
        throw new Error(`Failed to update stage status: ${error.message}`);
      }

      console.log('✅ Stage status updated successfully');
      toast.success('Stage status updated successfully');
      return true;
    } catch (err) {
      console.error('❌ Error updating stage status:', err);
      toast.error('Failed to update stage status');
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  return {
    updateStageStatus,
    isUpdating
  };
};

// Utility function to group instances by stage
export const groupInstancesByStage = (instances: JobStageInstance[]) => {
  const groups: Record<string, JobStageInstance[]> = {};
  
  instances.forEach(instance => {
    const stageId = instance.production_stage_id;
    if (!groups[stageId]) {
      groups[stageId] = [];
    }
    groups[stageId].push(instance);
  });
  
  return groups;
};

// Utility function to get active instances
export const getActiveInstances = (instances: JobStageInstance[]) => {
  return instances.filter(instance => instance.status === 'active');
};

// Utility function to get pending instances
export const getPendingInstances = (instances: JobStageInstance[]) => {
  return instances.filter(instance => instance.status === 'pending');
};

// Utility function to get completed instances
export const getCompletedInstances = (instances: JobStageInstance[]) => {
  return instances.filter(instance => instance.status === 'completed');
};