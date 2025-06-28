
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { runComprehensiveWorkflowDiagnostics, executeComprehensiveWorkflowRepair } from "@/utils/tracker/workflowDiagnostics";

export interface WorkflowAlert {
  id: string;
  type: 'missing_stages' | 'orphaned_stages' | 'category_missing' | 'workflow_inconsistent';
  severity: 'low' | 'medium' | 'high' | 'critical';
  job_id: string;
  job_wo_no: string;
  message: string;
  detected_at: Date;
  category_name?: string;
  auto_repairable: boolean;
}

export const useWorkflowMonitoring = (enabled: boolean = false) => {
  const [alerts, setAlerts] = useState<WorkflowAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkWorkflowIntegrity = async () => {
    if (!enabled) return;

    try {
      setIsMonitoring(true);
      console.log('🔍 Running workflow integrity monitoring check...');
      
      const { diagnostics, summary } = await runComprehensiveWorkflowDiagnostics();
      
      const newAlerts: WorkflowAlert[] = diagnostics.map(diagnostic => {
        const alertType = diagnostic.missing_stages.length > 0 ? 'missing_stages' :
                         diagnostic.orphaned_stages.length > 0 ? 'orphaned_stages' :
                         !diagnostic.category_id ? 'category_missing' : 'workflow_inconsistent';
        
        const severity = diagnostic.issue_severity === 'critical' ? 'critical' :
                        diagnostic.issue_severity === 'high' ? 'high' :
                        diagnostic.issue_severity === 'moderate' ? 'medium' : 'low';

        let message = '';
        if (diagnostic.missing_stages.length > 0) {
          message = `Missing ${diagnostic.missing_stages.length} workflow stage${diagnostic.missing_stages.length > 1 ? 's' : ''}`;
        } else if (diagnostic.orphaned_stages.length > 0) {
          message = `Has ${diagnostic.orphaned_stages.length} orphaned stage${diagnostic.orphaned_stages.length > 1 ? 's' : ''}`;
        } else if (!diagnostic.category_id) {
          message = 'No category assigned';
        } else {
          message = 'Workflow inconsistency detected';
        }

        return {
          id: `${alertType}_${diagnostic.job_id}`,
          type: alertType,
          severity,
          job_id: diagnostic.job_id,
          job_wo_no: diagnostic.job_wo_no,
          message,
          detected_at: new Date(),
          category_name: diagnostic.category_name || undefined,
          auto_repairable: diagnostic.category_id !== null && diagnostic.missing_stages.length > 0 && diagnostic.orphaned_stages.length === 0
        };
      });

      setAlerts(newAlerts);
      setLastCheck(new Date());

      // Show notification for high/critical severity alerts
      const criticalAlerts = newAlerts.filter(alert => alert.severity === 'critical');
      const highAlerts = newAlerts.filter(alert => alert.severity === 'high');
      
      if (criticalAlerts.length > 0) {
        toast.error(`🚨 Critical Workflow Issues: ${criticalAlerts.length} jobs need immediate attention`, {
          description: 'Check the diagnostics panel for details'
        });
      } else if (highAlerts.length > 0) {
        toast.warning(`⚠️ Workflow Issues: ${highAlerts.length} jobs need attention`, {
          description: 'Check the diagnostics panel for details'
        });
      }

      console.log('✅ Workflow monitoring check complete:', {
        totalAlerts: newAlerts.length,
        criticalAlerts: criticalAlerts.length,
        highAlerts: highAlerts.length,
        systemHealthScore: summary.system_health_score
      });

    } catch (error) {
      console.error('❌ Workflow monitoring failed:', error);
      toast.error('Workflow monitoring check failed');
    } finally {
      setIsMonitoring(false);
    }
  };

  // Auto-repair function for simple cases
  const autoRepairWorkflows = async (alertIds: string[]) => {
    const repairableAlerts = alerts.filter(alert => 
      alertIds.includes(alert.id) && alert.auto_repairable
    );
    
    if (repairableAlerts.length === 0) {
      toast.warning('No automatically repairable workflows selected');
      return;
    }

    try {
      console.log(`🔧 Starting auto-repair for ${repairableAlerts.length} workflows...`);
      
      // Convert alerts to diagnostics format for repair
      const diagnosticsForRepair = repairableAlerts.map(alert => ({
        job_id: alert.job_id,
        job_wo_no: alert.job_wo_no,
        job_table_name: 'production_jobs',
        category_id: alert.category_name ? 'placeholder' : null, // We'd need actual category_id
        category_name: alert.category_name,
        has_custom_workflow: false,
        expected_stages: 0,
        actual_stages: 0,
        missing_stages: [],
        orphaned_stages: [],
        workflow_progress: { total_stages: 0, completed_stages: 0, active_stages: 0, pending_stages: 0 },
        issue_severity: alert.severity as any,
        recommendations: []
      }));

      // For now, we'll use individual repair calls since we need proper diagnostic objects
      let successCount = 0;
      for (const alert of repairableAlerts) {
        try {
          // Get the job's category_id first
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
              successCount++;
              console.log(`✅ Auto-repaired workflow for job ${alert.job_wo_no}`);
            }
          }
        } catch (error) {
          console.error(`❌ Failed to auto-repair job ${alert.job_id}:`, error);
        }
      }

      if (successCount > 0) {
        toast.success(`✅ Auto-repaired ${successCount} workflow${successCount > 1 ? 's' : ''}`);
        // Remove successfully repaired alerts
        setAlerts(prev => prev.filter(a => 
          !repairableAlerts.slice(0, successCount).some(repaired => repaired.id === a.id)
        ));
        
        // Re-check after a delay
        setTimeout(checkWorkflowIntegrity, 2000);
      } else {
        toast.error('Failed to auto-repair any workflows');
      }

    } catch (error) {
      console.error('❌ Auto-repair process failed:', error);
      toast.error('Auto-repair process failed');
    }
  };

  // Start monitoring with periodic checks
  useEffect(() => {
    if (!enabled) {
      setIsMonitoring(false);
      return;
    }

    // Initial check
    checkWorkflowIntegrity();

    // Set up periodic monitoring (every 10 minutes)
    const monitoringInterval = setInterval(checkWorkflowIntegrity, 10 * 60 * 1000);

    // Set up real-time monitoring for job changes
    const channel = supabase
      .channel('workflow_monitoring_v2')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_jobs'
        },
        (payload) => {
          console.log('🔄 Production job change detected, scheduling integrity check...');
          // Debounce the check to avoid too frequent runs
          setTimeout(checkWorkflowIntegrity, 3000);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_stage_instances'
        },
        (payload) => {
          console.log('🔄 Job stage change detected, scheduling integrity check...');
          setTimeout(checkWorkflowIntegrity, 3000);
        }
      )
      .subscribe();

    return () => {
      clearInterval(monitoringInterval);
      supabase.removeChannel(channel);
      setIsMonitoring(false);
    };
  }, [enabled]);

  return { 
    alerts, 
    isMonitoring, 
    lastCheck,
    checkWorkflowIntegrity, 
    autoRepairWorkflows 
  };
};
