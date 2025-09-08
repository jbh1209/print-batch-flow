import { useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ScheduledJobStage } from "./useScheduledJobs";

export interface DepartmentRules {
  id: string;
  name: string;
  allows_concurrent_jobs: boolean;
  max_concurrent_jobs: number;
  requires_supervisor_override: boolean;
}

export interface JobSelection {
  jobId: string;
  stageId: string;
  woNo: string;
  customer: string;
  stageName: string;
  departmentName?: string;
  isCompatible: boolean;
  conflictReasons: string[];
}

export const useConcurrentJobManagement = () => {
  const { user } = useAuth();
  const [selectedJobs, setSelectedJobs] = useState<JobSelection[]>([]);
  const [departmentRules, setDepartmentRules] = useState<DepartmentRules[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load department rules
  const loadDepartmentRules = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select(`
          id,
          name,
          allows_concurrent_jobs,
          max_concurrent_jobs
        `);

      if (error) throw error;

      const rules: DepartmentRules[] = (data || []).map(dept => ({
        id: dept.id,
        name: dept.name,
        allows_concurrent_jobs: dept.allows_concurrent_jobs || false,
        max_concurrent_jobs: dept.max_concurrent_jobs || 1,
        requires_supervisor_override: !dept.allows_concurrent_jobs
      }));

      setDepartmentRules(rules);
    } catch (error) {
      console.error('❌ Error loading department rules:', error);
      toast.error('Failed to load department rules');
    }
  }, []);

  // Check job compatibility for concurrent processing
  const checkJobCompatibility = useCallback((jobs: ScheduledJobStage[]): JobSelection[] => {
    return jobs.map(job => {
      const conflicts: string[] = [];
      let isCompatible = true;

      // Find department rules for this job's stage
      const stageName = job.stage_name.toLowerCase();
      let departmentName = 'Unknown';
      let allowsConcurrent = false;

      // Department detection logic based on stage names
      if (stageName.includes('print')) {
        departmentName = 'Printing';
        allowsConcurrent = true; // Printing typically allows concurrent
      } else if (stageName.includes('finish') || stageName.includes('cut') || stageName.includes('fold')) {
        departmentName = 'Finishing';
        allowsConcurrent = false; // Finishing typically sequential
      } else if (stageName.includes('pack')) {
        departmentName = 'Packaging';
        allowsConcurrent = true; // Packaging can be concurrent
      }

      // Check if this job can be processed concurrently
      if (!allowsConcurrent) {
        isCompatible = false;
        conflicts.push(`${departmentName} requires sequential processing`);
      }

      // Check for scheduling conflicts
      if (selectedJobs.length > 0) {
        const hasScheduleConflict = selectedJobs.some(selected => {
          // Simple time overlap check
          if (job.scheduled_start_at && selected.stageId !== job.id) {
            return true; // Simplified - would need proper time overlap logic
          }
          return false;
        });

        if (hasScheduleConflict) {
          conflicts.push('Schedule overlap detected');
          isCompatible = false;
        }
      }

      return {
        jobId: job.job_id,
        stageId: job.id,
        woNo: job.wo_no,
        customer: job.customer,
        stageName: job.stage_name,
        departmentName,
        isCompatible,
        conflictReasons: conflicts
      };
    });
  }, [selectedJobs]);

  // Toggle job selection
  const toggleJobSelection = useCallback((job: ScheduledJobStage) => {
    const jobSelection = checkJobCompatibility([job])[0];
    
    setSelectedJobs(prev => {
      const exists = prev.find(j => j.stageId === job.id);
      
      if (exists) {
        // Remove job
        return prev.filter(j => j.stageId !== job.id);
      } else {
        // Add job if compatible or with supervisor override
        if (!jobSelection.isCompatible) {
          toast.warning(`Job has conflicts: ${jobSelection.conflictReasons.join(', ')}`);
          return prev; // Don't add incompatible jobs for now
        }
        return [...prev, jobSelection];
      }
    });
  }, [checkJobCompatibility]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedJobs([]);
  }, []);

  // Check if jobs can be batched together
  const batchCompatibility = useMemo(() => {
    if (selectedJobs.length < 2) return { compatible: true, issues: [] };

    const issues: string[] = [];
    const departments = new Set(selectedJobs.map(j => j.departmentName));
    
    if (departments.size > 1) {
      issues.push('Jobs from different departments cannot be batched');
    }

    const incompatibleJobs = selectedJobs.filter(j => !j.isCompatible);
    if (incompatibleJobs.length > 0) {
      issues.push(`${incompatibleJobs.length} jobs have compatibility issues`);
    }

    return {
      compatible: issues.length === 0,
      issues
    };
  }, [selectedJobs]);

  // Start multiple jobs concurrently
  const startJobsBatch = useCallback(async (supervisorOverride?: {
    supervisorId: string;
    reason: string;
  }): Promise<boolean> => {
    if (selectedJobs.length === 0) return false;

    setIsProcessing(true);
    try {
      // Check if supervisor override is required
      const needsOverride = selectedJobs.some(job => 
        departmentRules.find(dept => dept.name === job.departmentName)?.requires_supervisor_override
      );

      if (needsOverride && !supervisorOverride) {
        toast.error('Supervisor override required for concurrent processing in this department');
        return false;
      }

      // Start all selected jobs
      const promises = selectedJobs.map(async (job) => {
        const { error } = await supabase
          .from('job_stage_instances')
          .update({
            status: 'active',
            started_at: new Date().toISOString(),
            started_by: user?.id,
            notes: supervisorOverride ? `Concurrent start - Override by: ${supervisorOverride.reason}` : 'Concurrent batch start'
          })
          .eq('id', job.stageId);

        if (error) throw error;

        // Log barcode scan for audit trail
        await supabase
          .from('barcode_scan_log')
          .insert({
            user_id: user?.id,
            job_id: job.jobId,
            job_table_name: 'production_jobs',
            stage_id: job.stageId,
            barcode_data: `BATCH_START_${Date.now()}`,
            scan_result: 'success',
            action_taken: 'concurrent_batch_start'
          });

        return job;
      });

      await Promise.all(promises);

      toast.success(`Started ${selectedJobs.length} jobs concurrently`);
      clearSelection();
      return true;

    } catch (error) {
      console.error('❌ Error starting jobs batch:', error);
      toast.error('Failed to start jobs batch');
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [selectedJobs, departmentRules, user?.id, clearSelection]);

  // Allow queue flexibility - start job out of order with supervisor override
  const startJobOutOfOrder = useCallback(async (
    job: ScheduledJobStage, 
    supervisorOverride: {
      supervisorId: string;
      reason: string;
      overrideType: 'queue_order' | 'dependency' | 'schedule';
    }
  ): Promise<boolean> => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: user?.id,
          notes: `Supervisor Override - ${supervisorOverride.overrideType}: ${supervisorOverride.reason}`
        })
        .eq('id', job.id);

      if (error) throw error;

      // Log the override action
      await supabase
        .from('barcode_scan_log')
        .insert({
          user_id: user?.id,
          job_id: job.job_id,
          job_table_name: 'production_jobs',
          stage_id: job.id,
          barcode_data: `OVERRIDE_${supervisorOverride.overrideType.toUpperCase()}`,
          scan_result: 'success',
          action_taken: `supervisor_override_${supervisorOverride.overrideType}`
        });

      toast.success(`Started job ${job.wo_no} with supervisor override`);
      return true;

    } catch (error) {
      console.error('❌ Error starting job with override:', error);
      toast.error('Failed to start job with override');
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id]);

  // Group related jobs that can be worked together
  const groupRelatedJobs = useCallback((jobs: ScheduledJobStage[]) => {
    const groups = new Map();

    jobs.forEach(job => {
      // Group by customer and stage for potential batch processing
      const groupKey = `${job.customer}_${job.stage_name}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          customer: job.customer,
          stageName: job.stage_name,
          jobs: [],
          canBatch: true,
          batchReasons: []
        });
      }

      groups.get(groupKey).jobs.push(job);
    });

    // Convert map to array and sort by potential batch size
    return Array.from(groups.values())
      .filter(group => group.jobs.length >= 1)
      .sort((a, b) => b.jobs.length - a.jobs.length);
  }, []);

  return {
    selectedJobs,
    departmentRules,
    isProcessing,
    batchCompatibility,
    // Actions
    loadDepartmentRules,
    toggleJobSelection,
    clearSelection,
    checkJobCompatibility,
    startJobsBatch,
    startJobOutOfOrder,
    groupRelatedJobs
  };
};