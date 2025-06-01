import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useProductionStages } from "./useProductionStages";

interface EnhancedProductionJob {
  id: string;
  wo_no: string;
  customer?: string;
  reference?: string;
  qty?: number;
  due_date?: string;
  status?: string;
  category?: string;
  category_id?: string;
  has_custom_workflow?: boolean;
  current_stage?: string;
  has_workflow: boolean;
  workflow_progress?: {
    completed: number;
    total: number;
    percentage: number;
  };
  user_id: string;
  user_name?: string;
  so_no?: string;
  qt_no?: string;
  rep?: string;
  location?: string;
  date?: string;
  highlighted?: boolean;
  qr_code_url?: string;
  qr_code_data?: string;
}

export const useEnhancedProductionJobs = () => {
  const [jobs, setJobs] = useState<EnhancedProductionJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { stages } = useProductionStages();

  const fetchJobs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('🔄 Fetching enhanced production jobs...');

      // Fetch jobs with their stage instances
      const { data: jobsData, error: jobsError } = await supabase
        .from('production_jobs')
        .select(`
          *,
          categories!production_jobs_category_id_fkey(
            id,
            name,
            color
          )
        `)
        .order('created_at', { ascending: false });

      if (jobsError) {
        console.error('❌ Jobs fetch error:', jobsError);
        throw jobsError;
      }

      // Fetch stage instances for all jobs
      const { data: stageInstances, error: stageError } = await supabase
        .from('job_stage_instances')
        .select(`
          job_id,
          status,
          stage_order,
          production_stage:production_stages(
            id,
            name,
            color
          )
        `)
        .eq('job_table_name', 'production_jobs')
        .order('stage_order');

      if (stageError) {
        console.error('❌ Stage instances fetch error:', stageError);
        throw stageError;
      }

      // Group stage instances by job_id
      const stagesByJob = (stageInstances || []).reduce((acc, instance) => {
        if (!acc[instance.job_id]) {
          acc[instance.job_id] = [];
        }
        acc[instance.job_id].push(instance);
        return acc;
      }, {} as Record<string, any[]>);

      // Enhance jobs with workflow information
      const enhancedJobs: EnhancedProductionJob[] = (jobsData || []).map(job => {
        const jobStages = stagesByJob[job.id] || [];
        const hasWorkflow = jobStages.length > 0;
        
        // Find current active stage
        const activeStage = jobStages.find(stage => stage.status === 'active');
        const currentStage = activeStage?.production_stage?.name || null;
        
        // Calculate workflow progress
        const completedStages = jobStages.filter(stage => stage.status === 'completed').length;
        const totalStages = jobStages.length;
        const progressPercentage = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

        return {
          ...job,
          category: job.categories?.name || null,
          has_workflow: hasWorkflow,
          current_stage: currentStage,
          workflow_progress: {
            completed: completedStages,
            total: totalStages,
            percentage: progressPercentage
          }
        };
      });

      console.log('✅ Enhanced production jobs fetched successfully:', enhancedJobs.length);
      setJobs(enhancedJobs);
    } catch (err) {
      console.error('❌ Error fetching enhanced production jobs:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load production jobs";
      setError(errorMessage);
      toast.error("Failed to load production jobs");
    } finally {
      setIsLoading(false);
    }
  };

  const startStage = async (jobId: string, stageId: string) => {
    try {
      console.log('🔄 Starting stage...', { jobId, stageId });
      
      const { error } = await supabase
        .from('job_stage_instances')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs')
        .eq('production_stage_id', stageId)
        .eq('status', 'pending');

      if (error) throw error;

      console.log('✅ Stage started successfully');
      await fetchJobs(); // Refresh data
      return true;
    } catch (err) {
      console.error('❌ Error starting stage:', err);
      return false;
    }
  };

  const completeStage = async (jobId: string, stageId: string) => {
    try {
      console.log('🔄 Completing stage...', { jobId, stageId });
      
      const { data, error } = await supabase.rpc('advance_job_stage', {
        p_job_id: jobId,
        p_job_table_name: 'production_jobs',
        p_current_stage_id: stageId
      });

      if (error) throw error;
      if (!data) throw new Error('Stage advancement failed');

      console.log('✅ Stage completed successfully');
      await fetchJobs(); // Refresh data
      return true;
    } catch (err) {
      console.error('❌ Error completing stage:', err);
      return false;
    }
  };

  const recordQRScan = async (jobId: string, stageId: string, qrData?: any) => {
    try {
      console.log('🔄 Recording QR scan...', { jobId, stageId });
      
      const { error } = await supabase
        .from('job_stage_instances')
        .update({ 
          qr_scan_data: {
            ...qrData,
            scan_type: 'qr_scan',
            scanned_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('job_id', jobId)
        .eq('job_table_name', 'production_jobs')
        .eq('production_stage_id', stageId);

      if (error) throw error;

      console.log('✅ QR scan recorded successfully');
      await fetchJobs(); // Refresh data
      return true;
    } catch (err) {
      console.error('❌ Error recording QR scan:', err);
      return false;
    }
  };

  // Set up real-time subscription
  useEffect(() => {
    fetchJobs();

    const channel = supabase
      .channel('production-jobs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_jobs'
        },
        () => {
          console.log('🔄 Production jobs changed, refetching...');
          fetchJobs();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_stage_instances'
        },
        () => {
          console.log('🔄 Job stage instances changed, refetching...');
          fetchJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    jobs,
    isLoading,
    error,
    refreshJobs: fetchJobs,
    startStage,
    completeStage,
    recordQRScan
  };
};
