
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

      // Fetch jobs with category information and current stage
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

      // For each job, get the current active stage if it has workflow
      const jobsWithWorkflow = await Promise.all(
        (jobsData || []).map(async (job) => {
          let currentStage = null;
          let hasWorkflow = false;

          if (job.category_id) {
            // Check if job has stage instances (workflow initialized)
            const { data: stageInstances, error: stageError } = await supabase
              .from('job_stage_instances')
              .select(`
                status,
                production_stage:production_stages(name)
              `)
              .eq('job_id', job.id)
              .eq('job_table_name', 'production_jobs');

            if (!stageError && stageInstances && stageInstances.length > 0) {
              hasWorkflow = true;
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
            current_stage: currentStage
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

  useEffect(() => {
    fetchJobs();
    fetchCategories();
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
    fetchJobs
  };
};
