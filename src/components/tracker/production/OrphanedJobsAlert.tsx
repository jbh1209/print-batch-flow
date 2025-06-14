
import React, { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Wrench, RefreshCw, Loader2 } from "lucide-react";
import { useWorkflowInitialization } from "@/hooks/tracker/useWorkflowInitialization";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OrphanedJobsAlertProps {
  onRepaired: () => void;
  // orphanedJobsCount prop is removed, component will fetch its own.
}

export const OrphanedJobsAlert: React.FC<OrphanedJobsAlertProps> = ({
  onRepaired
}) => {
  const [isRepairing, setIsRepairing] = useState(false);
  const [isLoadingCount, setIsLoadingCount] = useState(true);
  const [orphanedJobsCount, setOrphanedJobsCount] = useState(0);
  const { repairJobWorkflow } = useWorkflowInitialization();

  const fetchOrphanedJobCount = async () => {
    setIsLoadingCount(true);
    try {
      // Find all jobs with a category
      const { data: jobsWithCategory, error: jobsError } = await supabase
        .from('production_jobs')
        .select('id, category_id', { count: 'exact' })
        .not('category_id', 'is', null);

      if (jobsError) throw jobsError;

      if (!jobsWithCategory || jobsWithCategory.length === 0) {
        setOrphanedJobsCount(0);
        setIsLoadingCount(false);
        return;
      }

      let count = 0;
      // Check each job for missing stages in batches to avoid too many requests
      const batchSize = 50;
      for (let i = 0; i < jobsWithCategory.length; i += batchSize) {
          const jobBatch = jobsWithCategory.slice(i, i + batchSize);
          const jobIds = jobBatch.map(j => j.id);

          const { data: stagesData, error: stagesError } = await supabase
              .from('job_stage_instances')
              .select('job_id', { count: 'exact' })
              .in('job_id', jobIds)
              .eq('job_table_name', 'production_jobs')
              .gt('stage_order', -1); // A simple condition to ensure we get some rows per job if stages exist

          if (stagesError) {
              console.error("Error fetching stages for orphaned job check", stagesError);
              // Potentially skip this batch or handle error
              continue;
          }
          
          const jobIdsWithStages = new Set(stagesData?.map(s => s.job_id) || []);
          
          for (const job of jobBatch) {
              if (!jobIdsWithStages.has(job.id)) {
                  count++;
              }
          }
      }
      setOrphanedJobsCount(count);
    } catch (error) {
      console.error('Error fetching orphaned job count:', error);
      toast.error("Could not verify orphaned jobs count.");
      setOrphanedJobsCount(0); // Default to 0 on error
    } finally {
      setIsLoadingCount(false);
    }
  };

  useEffect(() => {
    fetchOrphanedJobCount();
  }, []);


  const handleBulkRepair = async () => {
    setIsRepairing(true);
    try {
      // Re-fetch orphaned jobs to ensure we are working with the latest data
      const { data: jobsToRepair, error: fetchError } = await supabase
        .from('production_jobs')
        .select('id, category_id, wo_no')
        .not('category_id', 'is', null);

      if (fetchError) throw fetchError;

      if (!jobsToRepair || jobsToRepair.length === 0) {
        toast.info('No jobs with categories found to check for repair.');
        setIsRepairing(false);
        fetchOrphanedJobCount(); // Refresh count
        return;
      }

      let repairedCount = 0;
      let actualOrphanedFound = 0;
      const repairPromises = [];

      for (const job of jobsToRepair) {
        const { data: stages, error: stageCheckError } = await supabase
          .from('job_stage_instances')
          .select('id')
          .eq('job_id', job.id)
          .eq('job_table_name', 'production_jobs')
          .limit(1);

        if (stageCheckError) {
          console.error(`Error checking stages for job ${job.wo_no || job.id}:`, stageCheckError);
          continue; // Skip this job on error
        }

        if (!stages || stages.length === 0) {
          actualOrphanedFound++;
          console.log(`🔧 Attempting to repair orphaned job: ${job.wo_no || job.id} (Category: ${job.category_id})`);
          // Add repair promise
          repairPromises.push(
            repairJobWorkflow(job.id, 'production_jobs', job.category_id).then(success => {
              if (success) repairedCount++;
            })
          );
        }
      }
      
      await Promise.all(repairPromises);

      if (repairedCount > 0) {
        toast.success(`Successfully repaired ${repairedCount} orphaned job(s)`);
        onRepaired(); // Callback to refresh parent data
      } else if (actualOrphanedFound === 0) {
        toast.info('No orphaned jobs found that needed repair.');
      } else {
        toast.error(`Attempted to repair ${actualOrphanedFound} job(s), but ${repairedCount} succeeded. Check logs.`);
      }

    } catch (error) {
      console.error('Error during bulk repair of orphaned jobs:', error);
      toast.error('Failed to repair orphaned jobs. See console for details.');
    } finally {
      setIsRepairing(false);
      fetchOrphanedJobCount(); // Refresh count after repair attempt
    }
  };
  
  if (isLoadingCount) {
    return (
      <Alert className="border-blue-200 bg-blue-50">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        <AlertDescription className="text-blue-800 ml-2">
          Checking for jobs with missing workflows...
        </AlertDescription>
      </Alert>
    );
  }

  if (orphanedJobsCount === 0) return null;

  return (
    <Alert className="border-orange-200 bg-orange-50">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertDescription className="text-orange-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">
              {orphanedJobsCount} job(s) have categories but are missing workflow stages.
            </p>
            <p className="text-sm mt-1">
              These jobs may not function correctly. Repairing will attempt to initialize their workflows.
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
            {isRepairing ? 'Repairing...' : `Repair ${orphanedJobsCount} Job(s)`}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};
