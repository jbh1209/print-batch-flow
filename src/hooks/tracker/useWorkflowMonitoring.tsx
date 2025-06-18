
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface WorkflowAlert {
  id: string;
  type: 'missing_stages' | 'orphaned_job' | 'invalid_workflow';
  severity: 'low' | 'medium' | 'high';
  job_id: string;
  job_wo_no: string;
  message: string;
  detected_at: Date;
}

export const useWorkflowMonitoring = (enabled: boolean = false) => {
  const [alerts, setAlerts] = useState<WorkflowAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const checkWorkflowIntegrity = async () => {
    if (!enabled) return;

    try {
      console.log('🔍 Running workflow integrity check...');
      
      const { data: jobsWithCategories, error } = await supabase
        .from('production_jobs')
        .select(`
          id,
          wo_no,
          category_id,
          created_at,
          categories (
            id,
            name,
            category_production_stages (
              production_stage_id
            )
          ),
          job_stage_instances (
            id,
            production_stage_id
          )
        `)
        .not('category_id', 'is', null);

      if (error) throw error;

      const newAlerts: WorkflowAlert[] = [];

      for (const job of jobsWithCategories || []) {
        if (!job.categories) continue;

        const expectedStages = job.categories.category_production_stages.length;
        const actualStages = job.job_stage_instances.length;

        // Check for missing stages
        if (actualStages < expectedStages) {
          newAlerts.push({
            id: `missing_${job.id}`,
            type: 'missing_stages',
            severity: actualStages === 0 ? 'high' : 'medium',
            job_id: job.id,
            job_wo_no: job.wo_no,
            message: `Missing ${expectedStages - actualStages} of ${expectedStages} workflow stages`,
            detected_at: new Date()
          });
        }

        // Check for orphaned jobs (category but no stages)
        if (job.category_id && actualStages === 0) {
          newAlerts.push({
            id: `orphaned_${job.id}`,
            type: 'orphaned_job',
            severity: 'high',
            job_id: job.id,
            job_wo_no: job.wo_no,
            message: 'Job has category assigned but no workflow stages',
            detected_at: new Date()
          });
        }
      }

      // Check for jobs without categories that might need them
      const { data: uncategorizedJobs, error: uncategorizedError } = await supabase
        .from('production_jobs')
        .select('id, wo_no, created_at')
        .is('category_id', null)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

      if (!uncategorizedError && uncategorizedJobs) {
        for (const job of uncategorizedJobs) {
          newAlerts.push({
            id: `uncategorized_${job.id}`,
            type: 'orphaned_job',
            severity: 'low',
            job_id: job.id,
            job_wo_no: job.wo_no,
            message: 'Recent job without category assignment',
            detected_at: new Date()
          });
        }
      }

      setAlerts(newAlerts);

      // Show notification for high severity alerts
      const highSeverityAlerts = newAlerts.filter(alert => alert.severity === 'high');
      if (highSeverityAlerts.length > 0) {
        toast.error(`Workflow Alert: ${highSeverityAlerts.length} jobs need immediate attention`, {
          description: 'Check the diagnostics panel for details'
        });
      }

      console.log('✅ Workflow integrity check complete:', {
        totalAlerts: newAlerts.length,
        highSeverity: newAlerts.filter(a => a.severity === 'high').length
      });

    } catch (error) {
      console.error('❌ Workflow monitoring failed:', error);
    }
  };

  // Auto-repair function for simple cases
  const autoRepairWorkflows = async (alertIds: string[]) => {
    const alertsToRepair = alerts.filter(alert => alertIds.includes(alert.id));
    
    for (const alert of alertsToRepair) {
      if (alert.type === 'missing_stages') {
        try {
          // Get job category and repair
          const { data: job, error } = await supabase
            .from('production_jobs')
            .select('category_id')
            .eq('id', alert.job_id)
            .single();

          if (!error && job?.category_id) {
            const { error: repairError } = await supabase.rpc('initialize_job_stages_auto', {
              p_job_id: alert.job_id,
              p_job_table_name: 'production_jobs',
              p_category_id: job.category_id
            });

            if (!repairError) {
              toast.success(`Auto-repaired workflow for job ${alert.job_wo_no}`);
              // Remove the alert from our list
              setAlerts(prev => prev.filter(a => a.id !== alert.id));
            }
          }
        } catch (error) {
          console.error(`Failed to auto-repair job ${alert.job_id}:`, error);
        }
      }
    }
  };

  // Start monitoring with periodic checks
  useEffect(() => {
    if (!enabled) return;

    setIsMonitoring(true);
    
    // Initial check
    checkWorkflowIntegrity();

    // Set up periodic monitoring (every 5 minutes)
    const monitoringInterval = setInterval(checkWorkflowIntegrity, 5 * 60 * 1000);

    // Set up real-time monitoring for new jobs
    const channel = supabase
      .channel('workflow_monitoring')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'production_jobs'
        },
        () => {
          // Check new jobs after a short delay to allow category assignment
          setTimeout(checkWorkflowIntegrity, 2000);
        }
      )
      .subscribe();

    return () => {
      setIsMonitoring(false);
      clearInterval(monitoringInterval);
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  return {
    alerts,
    isMonitoring,
    checkWorkflowIntegrity,
    autoRepairWorkflows,
    clearAlert: (alertId: string) => {
      setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    }
  };
};
