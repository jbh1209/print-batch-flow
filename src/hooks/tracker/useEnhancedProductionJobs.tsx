
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProductionJob {
  id: string;
  wo_no: string;
  status: string;
  customer?: string | null;
  category?: string | null;
  category_id?: string | null;
  qty?: number | null;
  due_date?: string | null;
  location?: string | null;
  rep?: string | null;
  reference?: string | null;
  highlighted?: boolean;
  qr_code_url?: string | null;
  so_no?: string | null;
  qt_no?: string | null;
  user_name?: string | null;
  has_workflow?: boolean;
  current_stage?: string | null;
  stages?: JobStageInstance[];
}

interface JobStageInstance {
  id: string;
  production_stage_id: string;
  stage_order: number;
  status: 'pending' | 'active' | 'completed' | 'skipped';
  started_at?: string;
  completed_at?: string;
  production_stage: {
    id: string;
    name: string;
    color: string;
  };
}

interface Category {
  id: string;
  name: string;
  color: string;
  description?: string;
  sla_target_days: number;
}

export const useEnhancedProductionJobs = () => {
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('🔄 Fetching enhanced production jobs...');

      // Fetch jobs with category information and stage instances
      const { data: jobsData, error: jobsError } = await supabase
        .from('production_jobs')
        .select(`
          *,
          category:categories(
            id,
            name,
            color
          )
        `)
        .order('created_at', { ascending: false });

      if (jobsError) throw jobsError;

      // For each job, get the stage instances if it has workflow
      const jobsWithWorkflow = await Promise.all(
        (jobsData || []).map(async (job) => {
          let currentStage = null;
          let hasWorkflow = false;
          let stages: JobStageInstance[] = [];

          if (job.category_id) {
            // Check if job has stage instances (workflow initialized)
            const { data: stageInstances, error: stageError } = await supabase
              .from('job_stage_instances')
              .select(`
                id,
                production_stage_id,
                stage_order,
                status,
                started_at,
                completed_at,
                production_stage:production_stages(
                  id,
                  name,
                  color
                )
              `)
              .eq('job_id', job.id)
              .eq('job_table_name', 'production_jobs')
              .order('stage_order');

            if (!stageError && stageInstances && stageInstances.length > 0) {
              hasWorkflow = true;
              stages = stageInstances as JobStageInstance[];
              const activeStage = stageInstances.find(si => si.status === 'active');
              if (activeStage && activeStage.production_stage) {
                currentStage = activeStage.production_stage.name;
              }
            }
          }

          return {
            ...job,
            category: job.category?.name || null,
            has_workflow: hasWorkflow,
            current_stage: currentStage,
            stages
          };
        })
      );

      console.log('✅ Enhanced production jobs fetched successfully:', jobsWithWorkflow.length);
      setJobs(jobsWithWorkflow);
    } catch (err) {
      console.error('❌ Error fetching enhanced production jobs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
      toast.error('Failed to load production jobs');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      console.log('🔄 Fetching categories...');

      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (categoriesError) throw categoriesError;

      console.log('✅ Categories fetched successfully:', categoriesData?.length || 0);
      setCategories(categoriesData || []);
    } catch (err) {
      console.error('❌ Error fetching categories:', err);
      toast.error('Failed to load categories');
    }
  };

  const startStage = async (jobId: string, stageId: string) => {
    try {
      console.log('🔄 Starting stage...', { jobId, stageId });

      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'active',
          started_at: new Date().toISOString()
        })
        .eq('id', stageId);

      if (error) throw error;

      console.log('✅ Stage started successfully');
      toast.success('Stage started successfully');
      await fetchJobs();
      return true;
    } catch (err) {
      console.error('❌ Error starting stage:', err);
      toast.error('Failed to start stage');
      return false;
    }
  };

  const completeStage = async (jobId: string, stageId: string) => {
    try {
      console.log('🔄 Completing stage...', { jobId, stageId });

      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', stageId);

      if (error) throw error;

      // Advance to next stage if available
      const job = jobs.find(j => j.id === jobId);
      if (job?.stages) {
        const currentStageIndex = job.stages.findIndex(s => s.id === stageId);
        const nextStage = job.stages[currentStageIndex + 1];
        
        if (nextStage) {
          await supabase
            .from('job_stage_instances')
            .update({ status: 'active' })
            .eq('id', nextStage.id);
        }
      }

      console.log('✅ Stage completed successfully');
      toast.success('Stage completed successfully');
      await fetchJobs();
      return true;
    } catch (err) {
      console.error('❌ Error completing stage:', err);
      toast.error('Failed to complete stage');
      return false;
    }
  };

  const recordQRScan = async (jobId: string, stageId: string) => {
    try {
      console.log('🔄 Recording QR scan...', { jobId, stageId });

      const qrData = {
        scanned_at: new Date().toISOString(),
        job_id: jobId,
        stage_id: stageId
      };

      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          qr_scan_data: qrData
        })
        .eq('id', stageId);

      if (error) throw error;

      console.log('✅ QR scan recorded successfully');
      toast.success('QR code scanned successfully');
      await fetchJobs();
      return true;
    } catch (err) {
      console.error('❌ Error recording QR scan:', err);
      toast.error('Failed to record QR scan');
      return false;
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchCategories();
  }, []);

  // Set up real-time subscription for stage changes
  useEffect(() => {
    const channel = supabase
      .channel('job_stage_instances_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_stage_instances'
        },
        (payload) => {
          console.log('Stage instance changed:', payload);
          fetchJobs(); // Refresh jobs when stages change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const refreshJobs = () => {
    fetchJobs();
  };

  const refreshCategories = () => {
    fetchCategories();
  };

  return {
    jobs,
    categories,
    isLoading,
    error,
    refreshJobs,
    refreshCategories,
    fetchJobs,
    startStage,
    completeStage,
    recordQRScan
  };
};
