import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, AlertTriangle, Eye, BarChart3 } from "lucide-react";
import { useAccessibleJobs, AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { useCategories } from "@/hooks/tracker/useCategories";
import { EnhancedProductionJobsList } from "./EnhancedProductionJobsList";
import { JobEditModal } from "@/components/tracker/jobs/JobEditModal";
import { CategoryAssignModal } from "@/components/tracker/jobs/CategoryAssignModal";
import { CustomWorkflowModal } from "@/components/tracker/jobs/CustomWorkflowModal";
import { BarcodeLabelsManager } from "@/components/tracker/BarcodeLabelsManager";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const ProductionManagerView = () => {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const { jobs, isLoading, error, startJob, completeJob, refreshJobs } = useAccessibleJobs({
    permissionType: 'manage',
    statusFilter
  });
  const { categories } = useCategories();
  const [refreshing, setRefreshing] = useState(false);

  // Modal states
  const [editingJob, setEditingJob] = useState<AccessibleJob | null>(null);
  const [categoryAssignJob, setCategoryAssignJob] = useState<AccessibleJob | null>(null);
  const [customWorkflowJob, setCustomWorkflowJob] = useState<AccessibleJob | null>(null);
  const [showCustomWorkflow, setShowCustomWorkflow] = useState(false);
  const [showBarcodeLabels, setShowBarcodeLabels] = useState(false);
  const [selectedJobsForBarcodes, setSelectedJobsForBarcodes] = useState<AccessibleJob[]>([]);

  // Debug logging
  React.useEffect(() => {
    console.log("📊 ProductionManagerView state:", {
      isLoading,
      error,
      jobsCount: jobs.length,
      statusFilter
    });
  }, [isLoading, error, jobs, statusFilter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    console.log("🔄 Manual refresh triggered");
    await refreshJobs();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleEditJob = (job: AccessibleJob) => {
    setEditingJob(job);
  };

  const handleCategoryAssign = (job: AccessibleJob) => {
    setCategoryAssignJob(job);
  };

  const handleCustomWorkflow = (job: AccessibleJob) => {
    setCustomWorkflowJob(job);
    setShowCustomWorkflow(true);
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('production_jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;

      toast.success('Job deleted successfully');
      await refreshJobs();
    } catch (err) {
      console.error('Error deleting job:', err);
      toast.error('Failed to delete job');
    }
  };

  const handleBulkCategoryAssign = (selectedJobs: AccessibleJob[]) => {
    if (selectedJobs.length > 0) {
      // Extract job IDs properly from AccessibleJob objects
      const jobIds = selectedJobs.map(j => j.job_id).filter(Boolean);
      
      console.log('🔍 Production Manager - Bulk Category Assign:', {
        selectedJobs,
        jobIds,
        firstJobStructure: selectedJobs[0]
      });

      const firstJob = {
        ...selectedJobs[0],
        isMultiple: true,
        selectedIds: jobIds // Use properly extracted job_id values
      };
      setCategoryAssignJob(firstJob as any);
    }
  };

  const handleBulkStatusUpdate = async (selectedJobs: AccessibleJob[], status: string) => {
    try {
      const { error } = await supabase
        .from('production_jobs')
        .update({ status })
        .in('id', selectedJobs.map(j => j.job_id));

      if (error) throw error;

      toast.success(`Updated ${selectedJobs.length} job(s) to ${status} status`);
      await refreshJobs();
    } catch (err) {
      console.error('Error updating job status:', err);
      toast.error('Failed to update job status');
    }
  };

  const handleBulkDelete = async (selectedJobs: AccessibleJob[]) => {
    try {
      const { error } = await supabase
        .from('production_jobs')
        .delete()
        .in('id', selectedJobs.map(j => j.job_id));

      if (error) throw error;

      toast.success(`Deleted ${selectedJobs.length} job(s) successfully`);
      await refreshJobs();
    } catch (err) {
      console.error('Error deleting jobs:', err);
      toast.error('Failed to delete jobs');
    }
  };

  const handleGenerateBarcodes = (selectedJobs: AccessibleJob[]) => {
    setSelectedJobsForBarcodes(selectedJobs);
    setShowBarcodeLabels(true);
  };

  const handleEditJobSave = () => {
    setEditingJob(null);
    refreshJobs();
  };

  const handleCategoryAssignComplete = () => {
    setCategoryAssignJob(null);
    refreshJobs();
  };

  const handleCustomWorkflowSuccess = () => {
    setShowCustomWorkflow(false);
    setCustomWorkflowJob(null);
    refreshJobs();
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Production Management</h1>
          <p className="text-gray-600">Overview of all production jobs</p>
          <p className="text-sm text-gray-500 mt-1">
            Managing {jobs.length} job{jobs.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={statusFilter || 'all'} onValueChange={(value) => setStatusFilter(value === 'all' ? null : value)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {uniqueStatuses.map(status => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Production Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Eye className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Total Jobs</p>
                <p className="text-2xl font-bold">{jobs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold">
                  {jobs.filter(j => j.current_stage_status === 'pending').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-2xl font-bold">
                  {jobs.filter(j => j.current_stage_status === 'active').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-gray-600">Avg Progress</p>
                <p className="text-2xl font-bold">
                  {jobs.length > 0 ? Math.round(jobs.reduce((sum, job) => sum + job.workflow_progress, 0) / jobs.length) : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Jobs List */}
      {jobs.length > 0 ? (
        <EnhancedProductionJobsList
          jobs={jobs}
          onStartJob={startJob}
          onCompleteJob={completeJob}
          onEditJob={setEditingJob}
          onCategoryAssign={setCategoryAssignJob}
          onCustomWorkflow={(job) => {
            setCustomWorkflowJob(job);
            setShowCustomWorkflow(true);
          }}
          onDeleteJob={async (jobId) => {
            try {
              const { error } = await supabase
                .from('production_jobs')
                .delete()
                .eq('id', jobId);

              if (error) throw error;

              toast.success('Job deleted successfully');
              await refreshJobs();
            } catch (err) {
              console.error('Error deleting job:', err);
              toast.error('Failed to delete job');
            }
          }}
          onBulkCategoryAssign={(selectedJobs) => {
            if (selectedJobs.length > 0) {
              const firstJob = {
                ...selectedJobs[0],
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
              await refreshJobs();
            } catch (err) {
              console.error('Error updating job status:', err);
              toast.error('Failed to update job status');
            }
          }}
          onBulkDelete={async (selectedJobs) => {
            try {
              const { error } = await supabase
                .from('production_jobs')
                .delete()
                .in('id', selectedJobs.map(j => j.job_id));

              if (error) throw error;

              toast.success(`Deleted ${selectedJobs.length} job(s) successfully`);
              await refreshJobs();
            } catch (err) {
              console.error('Error deleting jobs:', err);
              toast.error('Failed to delete jobs');
            }
          }}
          onGenerateBarcodes={(selectedJobs) => {
            setSelectedJobsForBarcodes(selectedJobs);
            setShowBarcodeLabels(true);
          }}
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
      {editingJob && (
        <JobEditModal
          job={editingJob}
          onClose={() => setEditingJob(null)}
          onSave={() => {
            setEditingJob(null);
            refreshJobs();
          }}
        />
      )}

      {categoryAssignJob && (
        <CategoryAssignModal
          job={categoryAssignJob}
          categories={categories}
          onClose={() => setCategoryAssignJob(null)}
          onAssign={() => {
            setCategoryAssignJob(null);
            refreshJobs();
          }}
        />
      )}

      {showCustomWorkflow && customWorkflowJob && (
        <CustomWorkflowModal
          isOpen={showCustomWorkflow}
          onClose={() => {
            setShowCustomWorkflow(false);
            setCustomWorkflowJob(null);
          }}
          job={customWorkflowJob}
          onSuccess={() => {
            setShowCustomWorkflow(false);
            setCustomWorkflowJob(null);
            refreshJobs();
          }}
        />
      )}

      {showBarcodeLabels && (
        <BarcodeLabelsManager 
          selectedJobs={selectedJobsForBarcodes}
          onClose={() => {
            setShowBarcodeLabels(false);
            setSelectedJobsForBarcodes([]);
          }}
        />
      )}
    </div>
  );
};
