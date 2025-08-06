import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { toast } from 'sonner';

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
}

interface JobsByDate {
  [dateKey: string]: ProductionCalendarJob[];
}

export const useProductionCalendarFixed = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<ProductionCalendarJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch jobs using separate queries to handle polymorphic relationships
  const fetchScheduledJobs = async () => {
    if (!user?.id) {
      setJobs([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      console.log("🗓️ Fetching scheduled jobs using separate queries...");

      // Step 1: Get all job schedule assignments
      const { data: scheduleAssignments, error: scheduleError } = await supabase
        .from('job_schedule_assignments')
        .select(`
          job_id,
          production_stage_id,
          scheduled_date,
          queue_position,
          estimated_duration_minutes,
          is_expedited,
          priority_score,
          shift_number,
          status,
          job_table_name
        `)
        .eq('status', 'scheduled')
        .eq('job_table_name', 'production_jobs')
        .gte('scheduled_date', '2025-08-01')
        .order('scheduled_date')
        .order('queue_position');

      if (scheduleError) {
        console.error("❌ Error fetching schedule assignments:", scheduleError);
        throw new Error(`Failed to fetch schedule assignments: ${scheduleError.message}`);
      }

      console.log("✅ Schedule assignments fetched:", scheduleAssignments?.length || 0);

      if (!scheduleAssignments || scheduleAssignments.length === 0) {
        setJobs([]);
        return;
      }

      // Step 2: Get unique job IDs and stage IDs
      const jobIds = [...new Set(scheduleAssignments.map(sa => sa.job_id))];
      const stageIds = [...new Set(scheduleAssignments.map(sa => sa.production_stage_id))];

      console.log("📋 Fetching data for:", jobIds.length, "jobs and", stageIds.length, "stages");

      // Step 3: Fetch production jobs data
      const { data: productionJobs, error: jobsError } = await supabase
        .from('production_jobs')
        .select('id, wo_no, customer, status, user_id')
        .in('id', jobIds);

      if (jobsError) {
        console.error("❌ Error fetching production jobs:", jobsError);
        throw new Error(`Failed to fetch production jobs: ${jobsError.message}`);
      }

      // Step 4: Fetch production stages data
      const { data: productionStages, error: stagesError } = await supabase
        .from('production_stages')
        .select('id, name, color')
        .in('id', stageIds);

      if (stagesError) {
        console.error("❌ Error fetching production stages:", stagesError);
        throw new Error(`Failed to fetch production stages: ${stagesError.message}`);
      }

      // Step 5: Fetch job stage instances for current status
      const { data: stageInstances, error: instancesError } = await supabase
        .from('job_stage_instances')
        .select('job_id, production_stage_id, status')
        .in('job_id', jobIds)
        .in('production_stage_id', stageIds);

      if (instancesError) {
        console.error("❌ Error fetching stage instances:", instancesError);
        // Don't throw here, just log and continue with default status
      }

      console.log("✅ All data fetched - Jobs:", productionJobs?.length, "Stages:", productionStages?.length, "Instances:", stageInstances?.length);

      // Step 6: Create lookup maps for efficient joining
      const jobsMap = new Map(productionJobs?.map(job => [job.id, job]) || []);
      const stagesMap = new Map(productionStages?.map(stage => [stage.id, stage]) || []);
      const instancesMap = new Map(stageInstances?.map(inst => [`${inst.job_id}-${inst.production_stage_id}`, inst.status]) || []);

      // Step 7: Combine all data
      const combinedJobs: ProductionCalendarJob[] = [];

      for (const assignment of scheduleAssignments) {
        const job = jobsMap.get(assignment.job_id);
        const stage = stagesMap.get(assignment.production_stage_id);
        const instanceKey = `${assignment.job_id}-${assignment.production_stage_id}`;
        const currentStageStatus = instancesMap.get(instanceKey) || 'pending';

        if (job && stage) {
          combinedJobs.push({
            job_id: assignment.job_id,
            wo_no: job.wo_no,
            customer: job.customer,
            status: job.status,
            stage_name: stage.name,
            stage_color: stage.color,
            scheduled_date: assignment.scheduled_date,
            queue_position: assignment.queue_position,
            estimated_duration_minutes: assignment.estimated_duration_minutes,
            is_expedited: assignment.is_expedited,
            priority_score: assignment.priority_score,
            shift_number: assignment.shift_number,
            current_stage_status: currentStageStatus,
            user_can_work: true, // Simplified for now
            production_stage_id: assignment.production_stage_id
          });
        } else {
          console.warn("⚠️ Missing data for assignment:", assignment.job_id, "job found:", !!job, "stage found:", !!stage);
        }
      }

      console.log("✅ Combined jobs processed:", combinedJobs.length);
      setJobs(combinedJobs);

    } catch (err) {
      console.error('❌ Error in fetchScheduledJobs:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load scheduled jobs";
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
  }, [user?.id]);

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