import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { getCurrentDate } from '@/utils/businessDays';

interface ProductionCalendarJob {
  job_id: string;
  wo_no: string;
  customer: string;
  status: string;
  stage_name: string;
  stage_color: string;
  scheduled_date: string;
  queue_position: number;
  estimated_duration_minutes: number;
  is_expedited: boolean;
  priority_score: number;
  shift_number: number;
  current_stage_status: string;
  user_can_work: boolean;
  production_stage_id: string;
  specification?: string;
  qty?: number;
}

interface JobsByDate {
  [dateKey: string]: ProductionCalendarJob[];
}

export const useProductionCalendarFixed = (selectedStageId?: string | null) => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<ProductionCalendarJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch jobs from the same source as the working list view
  const fetchScheduledJobs = async () => {
    if (!user?.id) {
      setJobs([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      console.log("🗓️ Fetching jobs from job_stage_instances (same as list view)...");

      // Step 1: Get job stage instances - ONLY current working stages
      // A job should only appear in its current working stage (first pending stage in sequence)
      const { data: allInstances, error: allInstancesError } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          job_id,
          production_stage_id,
          status,
          stage_order,
          queue_position,
          estimated_duration_minutes,
          scheduled_date,
          time_slot,
          job_table_name
        `)
        .in('status', ['pending', 'active'])
        .eq('job_table_name', 'production_jobs')
        .order('job_id')
        .order('stage_order');

      if (allInstancesError) {
        console.error("❌ Error fetching all job stage instances:", allInstancesError);
        throw new Error(`Failed to fetch job instances: ${allInstancesError.message}`);
      }

      // Filter to get only current working stages (first pending stage per job)
      const currentWorkingStages = new Map<string, any>();
      
      if (allInstances) {
        for (const instance of allInstances) {
          const jobId = instance.job_id;
          
          // For each job, only show the first pending stage OR any active stage
          if (instance.status === 'active' || !currentWorkingStages.has(jobId)) {
            if (instance.status === 'pending' && !currentWorkingStages.has(jobId)) {
              // First pending stage for this job
              currentWorkingStages.set(jobId, instance);
            } else if (instance.status === 'active') {
              // Always show active stages (override pending if needed)
              currentWorkingStages.set(jobId, instance);
            }
          }
        }
      }

      const instances = Array.from(currentWorkingStages.values());

      // Apply stage filter if provided
      let filteredInstances = instances;
      if (selectedStageId && selectedStageId !== 'batch-processing') {
        filteredInstances = instances.filter(inst => inst.production_stage_id === selectedStageId);
      }

      console.log("✅ Current working stage instances filtered:", filteredInstances?.length || 0);

      if (!filteredInstances || filteredInstances.length === 0) {
        setJobs([]);
        return;
      }

      // Step 2: Get unique job IDs and stage IDs from filtered instances
      const jobIds = [...new Set(filteredInstances.map(inst => inst.job_id))];
      const stageIds = [...new Set(filteredInstances.map(inst => inst.production_stage_id))];

      // Step 3: Fetch production jobs
      const { data: productionJobs, error: jobsError } = await supabase
        .from('production_jobs')
        .select('id, wo_no, customer, status, is_expedited, specification, qty')
        .in('id', jobIds);

      if (jobsError) {
        console.error("❌ Error fetching production jobs:", jobsError);
        throw new Error(`Failed to fetch production jobs: ${jobsError.message}`);
      }

      // Step 4: Fetch production stages
      const { data: productionStages, error: stagesError } = await supabase
        .from('production_stages')
        .select('id, name, color')
        .in('id', stageIds);

      if (stagesError) {
        console.error("❌ Error fetching production stages:", stagesError);
        throw new Error(`Failed to fetch production stages: ${stagesError.message}`);
      }

      // Step 5: Create lookup maps
      const jobsMap = new Map(productionJobs?.map(job => [job.id, job]) || []);
      const stagesMap = new Map(productionStages?.map(stage => [stage.id, stage]) || []);

      // Step 6: Transform data to match expected format
      const transformedJobs: ProductionCalendarJob[] = filteredInstances
        .map(instance => {
          const job = jobsMap.get(instance.job_id);
          const stage = stagesMap.get(instance.production_stage_id);

          if (!job || !stage) {
            console.warn("⚠️ Missing data for instance:", instance.job_id, "job found:", !!job, "stage found:", !!stage);
            return null;
          }

          return {
            job_id: job.id,
            wo_no: job.wo_no,
            customer: job.customer,
            status: instance.status,
            stage_name: stage.name,
            stage_color: stage.color || '#6B7280',
            scheduled_date: instance.scheduled_date || format(new Date(), 'yyyy-MM-dd'),
            queue_position: instance.queue_position || 1,
            estimated_duration_minutes: instance.estimated_duration_minutes || 120,
            is_expedited: job.is_expedited || false,
            priority_score: job.is_expedited ? 0 : 100,
            shift_number: 1,
            current_stage_status: instance.status,
            user_can_work: true,
            production_stage_id: instance.production_stage_id,
            specification: job.specification,
            qty: job.qty
          };
        })
        .filter(Boolean) as ProductionCalendarJob[];

      console.log("✅ Jobs transformed:", transformedJobs.length);
      setJobs(transformedJobs);

    } catch (err) {
      console.error('❌ Error in fetchScheduledJobs:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load jobs";
      setError(errorMessage);
      setJobs([]);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Group jobs by scheduled date
  const jobsByDate = useMemo(() => {
    const grouped: JobsByDate = {};
    
    console.log("📊 Grouping jobs by date:", jobs.length);
    
    jobs.forEach(job => {
      const dateKey = job.scheduled_date; // Already in YYYY-MM-DD format
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      
      grouped[dateKey].push(job);
    });

    // Sort jobs within each date by priority and queue position
    Object.keys(grouped).forEach(dateKey => {
      grouped[dateKey].sort((a, b) => {
        // Expedited jobs first
        if (a.is_expedited !== b.is_expedited) {
          return a.is_expedited ? -1 : 1;
        }
        // Then by queue position
        return a.queue_position - b.queue_position;
      });
    });

    console.log("📊 Jobs grouped by date:", Object.keys(grouped).map(date => 
      `${date}: ${grouped[date].length} jobs`
    ).join(', '));

    return grouped;
  }, [jobs]);

  // Start a job (update stage instance status)
  const startJob = async (jobId: string, stageId: string): Promise<boolean> => {
    try {
      console.log("🚀 Starting job:", jobId, "stage:", stageId);

      const { error } = await supabase
        .from('job_stage_instances')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: user?.id 
        })
        .eq('job_id', jobId)
        .eq('production_stage_id', stageId);

      if (error) {
        console.error("❌ Error starting job:", error);
        toast.error("Failed to start job");
        return false;
      }

      // Update local state optimistically
      setJobs(prev => prev.map(job => 
        job.job_id === jobId 
          ? { ...job, current_stage_status: 'active' }
          : job
      ));

      toast.success("Job started successfully");
      return true;
    } catch (error) {
      console.error("❌ Error in startJob:", error);
      toast.error("Failed to start job");
      return false;
    }
  };

  // Complete a job (update stage instance status)
  const completeJob = async (jobId: string, stageId: string): Promise<boolean> => {
    try {
      console.log("✅ Completing job:", jobId, "stage:", stageId);

      const { error } = await supabase
        .from('job_stage_instances')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user?.id 
        })
        .eq('job_id', jobId)
        .eq('production_stage_id', stageId);

      if (error) {
        console.error("❌ Error completing job:", error);
        toast.error("Failed to complete job");
        return false;
      }

      // Remove from local state or update status
      setJobs(prev => prev.filter(job => job.job_id !== jobId));

      toast.success("Job completed successfully");
      // Refresh to get updated data
      setTimeout(fetchScheduledJobs, 500);
      return true;
    } catch (error) {
      console.error("❌ Error in completeJob:", error);
      toast.error("Failed to complete job");
      return false;
    }
  };

  // Get jobs for a specific date
  const getJobsForDate = (dateString: string): ProductionCalendarJob[] => {
    const dateKey = format(new Date(dateString), 'yyyy-MM-dd');
    const jobsForDate = jobsByDate[dateKey] || [];
    console.log(`📅 Getting jobs for ${dateKey}:`, jobsForDate.length);
    return jobsForDate;
  };

  useEffect(() => {
    fetchScheduledJobs();
  }, [user?.id, selectedStageId]);

  return {
    jobs,
    jobsByDate,
    isLoading,
    error,
    startJob,
    completeJob,
    refreshJobs: fetchScheduledJobs,
    getJobsForDate
  };
};