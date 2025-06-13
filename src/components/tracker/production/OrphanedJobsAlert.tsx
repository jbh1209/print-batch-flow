
import React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Wrench, RefreshCw } from "lucide-react";
import { useWorkflowInitialization } from "@/hooks/tracker/useWorkflowInitialization";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OrphanedJobsAlertProps {
  orphanedJobsCount: number;
  onRepaired: () => void;
}

export const OrphanedJobsAlert: React.FC<OrphanedJobsAlertProps> = ({
  orphanedJobsCount,
  onRepaired
}) => {
  const [isRepairing, setIsRepairing] = React.useState(false);
  const { repairJobWorkflow } = useWorkflowInitialization();

  const handleBulkRepair = async () => {
    try {
      setIsRepairing(true);
      
      // Find all orphaned jobs
      const { data: orphanedJobs, error } = await supabase
        .from('production_jobs')
        .select('id, category_id')
        .not('category_id', 'is', null);

      if (error) throw error;

      if (!orphanedJobs || orphanedJobs.length === 0) {
        toast.info('No orphaned jobs found');
        return;
      }

      let repairedCount = 0;
      let orphanedCount = 0;

      for (const job of orphanedJobs) {
        // Check if this job actually has stages
        const { data: stages } = await supabase
          .from('job_stage_instances')
          .select('id')
          .eq('job_id', job.id)
          .eq('job_table_name', 'production_jobs')
          .limit(1);

        // If no stages but has category, it's orphaned
        if (!stages || stages.length === 0) {
          orphanedCount++;
          console.log(`🔧 Repairing orphaned job: ${job.id}`);
          
          const success = await repairJobWorkflow(job.id, 'production_jobs', job.category_id);
          if (success) {
            repairedCount++;
          }
        }
      }

      if (repairedCount > 0) {
        toast.success(`Successfully repaired ${repairedCount} orphaned job(s)`);
        onRepaired();
      } else if (orphanedCount === 0) {
        toast.info('No orphaned jobs found that need repair');
      } else {
        toast.error('Failed to repair orphaned jobs');
      }

    } catch (error) {
      console.error('Error during bulk repair:', error);
      toast.error('Failed to repair orphaned jobs');
    } finally {
      setIsRepairing(false);
    }
  };

  if (orphanedJobsCount === 0) return null;

  return (
    <Alert className="border-orange-200 bg-orange-50">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertDescription className="text-orange-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">
              {orphanedJobsCount} job(s) have categories but missing workflows
            </p>
            <p className="text-sm mt-1">
              These jobs need repair to function properly in the production system.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkRepair}
            disabled={isRepairing}
            className="ml-4 border-orange-300 text-orange-700 hover:bg-orange-100"
          >
            {isRepairing ? (
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Wrench className="h-3 w-3 mr-1" />
            )}
            {isRepairing ? 'Repairing...' : 'Repair All'}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};
