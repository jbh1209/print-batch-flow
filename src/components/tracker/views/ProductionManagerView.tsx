
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { useAccessibleJobs, AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { useCategories } from "@/hooks/tracker/useCategories";
import { EnhancedProductionJobsList } from "./EnhancedProductionJobsList";
import { ProductionManagerHeader } from "./components/ProductionManagerHeader";
import { ProductionManagerStats } from "./components/ProductionManagerStats";
import { ProductionManagerModals } from "./components/ProductionManagerModals";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/tracker/useUserRole";

export const ProductionManagerView = () => {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const { jobs, isLoading, error, startJob, completeJob, refreshJobs, invalidateCache } = useAccessibleJobs({
    permissionType: 'manage',
    statusFilter
  });
  const { categories } = useCategories();
  const { isAdmin } = useUserRole();
  const [refreshing, setRefreshing] = useState(false);

  // Modal states
  const [editingJob, setEditingJob] = useState<AccessibleJob | null>(null);
  const [categoryAssignJob, setCategoryAssignJob] = useState<AccessibleJob | null>(null);
  const [customWorkflowJob, setCustomWorkflowJob] = useState<AccessibleJob | null>(null);
  const [showCustomWorkflow, setShowCustomWorkflow] = useState(false);
  const [showBarcodeLabels, setShowBarcodeLabels] = useState(false);
  const [selectedJobsForBarcodes, setSelectedJobsForBarcodes] = useState<AccessibleJob[]>([]);

  // Map job data structure to ensure consistent ID property for UI components
  const normalizedJobs = React.useMemo(() => {
    return jobs.map(job => ({
      ...job,
      // Ensure job has 'id' property for UI components (map from job_id)
      id: job.job_id
    }));
  }, [jobs]);

  // Debug logging
  React.useEffect(() => {
    console.log("📊 ProductionManagerView state:", {
      isLoading,
      error,
      jobsCount: jobs.length,
      normalizedJobsCount: normalizedJobs.length,
      statusFilter
    });
  }, [isLoading, error, jobs, normalizedJobs, statusFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    console.log("🔄 Manual refresh triggered");
    // Invalidate cache first to ensure fresh data
    invalidateCache();
    await refreshJobs();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleBulkMarkCompleted = async (selectedJobs: AccessibleJob[]) => {
    if (!isAdmin) {
      toast.error('Only administrators can mark jobs as completed');
      return;
    }

    try {
      // Update job status to completed
      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({ 
          status: 'Completed',
          updated_at: new Date().toISOString()
        })
        .in('id', selectedJobs.map(j => j.job_id));

      if (jobError) throw jobError;

      // Complete any active stage instances
      const { error: stageError } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .in('job_id', selectedJobs.map(j => j.job_id))
        .in('status', ['active', 'pending']);

      if (stageError) throw stageError;

      toast.success(`Marked ${selectedJobs.length} job(s) as completed`);
      await handleRefresh(); // Use our enhanced refresh
    } catch (err) {
      console.error('Error marking jobs as completed:', err);
      toast.error('Failed to mark jobs as completed');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 h-full">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <span className="text-lg">Loading production overview...</span>
          <p className="text-sm text-gray-500 mt-2">
            Fetching jobs and permissions...
          </p>
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            size="sm"
            className="mt-4"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-red-700">Error Loading Production Data</h2>
            <p className="text-red-600 text-center mb-4">{error}</p>
            <Button onClick={handleRefresh} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const uniqueStatuses = Array.from(new Set(jobs.map(job => job.status))).filter(Boolean);

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      {/* Header */}
      <ProductionManagerHeader
        jobCount={jobs.length}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        uniqueStatuses={uniqueStatuses}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {/* Production Statistics */}
      <ProductionManagerStats jobs={jobs} />

      {/* Enhanced Jobs List */}
      {jobs.length > 0 ? (
        <EnhancedProductionJobsList
          jobs={normalizedJobs}
          onStartJob={startJob}
          onCompleteJob={completeJob}
          onEditJob={setEditingJob}
          onCategoryAssign={setCategoryAssignJob}
          onCustomWorkflow={(job) => {
            setCustomWorkflowJob(job);
            setShowCustomWorkflow(true);
          }}
          onDeleteJob={async (jobId) => {
            // Use the actual job_id for database operations
            const actualJobId = jobs.find(j => j.job_id === jobId)?.job_id || jobId;
            
            try {
              const { error } = await supabase
                .from('production_jobs')
                .delete()
                .eq('id', actualJobId);

              if (error) throw error;

              toast.success('Job deleted successfully');
              await handleRefresh(); // Use our enhanced refresh
            } catch (err) {
              console.error('Error deleting job:', err);
              toast.error('Failed to delete job');
            }
          }}
          onBulkCategoryAssign={(selectedJobs) => {
            if (selectedJobs.length > 0) {
              const firstJob = {
                ...selectedJobs[0],
                id: selectedJobs[0].job_id, // Map job_id to id for UI consistency
                isMultiple: true,
                selectedIds: selectedJobs.map(j => j.job_id)
              };
              setCategoryAssignJob(firstJob as any);
            }
          }}
          onBulkStatusUpdate={async (selectedJobs, status) => {
            try {
              const { error } = await supabase
                .from('production_jobs')
                .update({ status })
                .in('id', selectedJobs.map(j => j.job_id));

              if (error) throw error;

              toast.success(`Updated ${selectedJobs.length} job(s) to ${status} status`);
              await handleRefresh(); // Use our enhanced refresh
            } catch (err) {
              console.error('Error updating job status:', err);
              toast.error('Failed to update job status');
            }
          }}
          onBulkMarkCompleted={handleBulkMarkCompleted}
          onBulkDelete={async (selectedJobs) => {
            try {
              const { error } = await supabase
                .from('production_jobs')
                .delete()
                .in('id', selectedJobs.map(j => j.job_id));

              if (error) throw error;

              toast.success(`Deleted ${selectedJobs.length} job(s) successfully`);
              await handleRefresh(); // Use our enhanced refresh
            } catch (err) {
              console.error('Error deleting jobs:', err);
              toast.error('Failed to delete jobs');
            }
          }}
          onGenerateBarcodes={(selectedJobs) => {
            setSelectedJobsForBarcodes(selectedJobs);
            setShowBarcodeLabels(true);
          }}
          isAdmin={isAdmin}
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <AlertTriangle className="h-16 w-16 text-yellow-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Production Jobs</h3>
            <p className="text-gray-600 text-center">
              No production jobs found with the current filters.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      <ProductionManagerModals
        editingJob={editingJob}
        setEditingJob={setEditingJob}
        categoryAssignJob={categoryAssignJob}
        setCategoryAssignJob={setCategoryAssignJob}
        showCustomWorkflow={showCustomWorkflow}
        setShowCustomWorkflow={setShowCustomWorkflow}
        customWorkflowJob={customWorkflowJob}
        setCustomWorkflowJob={setCustomWorkflowJob}
        showBarcodeLabels={showBarcodeLabels}
        setShowBarcodeLabels={setShowBarcodeLabels}
        selectedJobsForBarcodes={selectedJobsForBarcodes}
        setSelectedJobsForBarcodes={setSelectedJobsForBarcodes}
        categories={categories}
        onRefresh={handleRefresh} // Use our enhanced refresh
      />
    </div>
  );
};
