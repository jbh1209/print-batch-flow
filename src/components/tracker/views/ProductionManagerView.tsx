
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { useAccessibleJobs, AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { useCategories } from "@/hooks/tracker/useCategories";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { EnhancedProductionJobsList } from "./EnhancedProductionJobsList";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const ProductionManagerView = () => {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const { jobs, isLoading, error, startJob, completeJob, refreshJobs, invalidateCache } = useAccessibleJobs({
    permissionType: 'manage',
    statusFilter
  });
  const { categories } = useCategories();
  const { isAdmin } = useUserRole();
  const [refreshing, setRefreshing] = useState(false);

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

  const handleDeleteJob = async (jobId: string) => {
    // Use the actual job_id for database operations
    const actualJobId = jobs.find(j => j.job_id === jobId)?.job_id || jobId;
    
    try {
      const { error } = await supabase
        .from('production_jobs')
        .delete()
        .eq('id', actualJobId);

      if (error) throw error;

      toast.success('Job deleted successfully');
      await handleRefresh();
    } catch (err) {
      console.error('Error deleting job:', err);
      toast.error('Failed to delete job');
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
    <div className="p-6 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Production Management</h1>
          <p className="text-gray-600">Overview of all production jobs</p>
          <p className="text-sm text-gray-500 mt-1">
            Managing {jobs.length} job{jobs.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <select 
            value={statusFilter || 'all'} 
            onChange={(e) => setStatusFilter(e.target.value === 'all' ? null : e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All Statuses</option>
            {uniqueStatuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          
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

      {/* Jobs List */}
      {jobs.length > 0 ? (
        <EnhancedProductionJobsList
          jobs={normalizedJobs}
          onStartJob={startJob}
          onCompleteJob={completeJob}
          onDeleteJob={handleDeleteJob}
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
    </div>
  );
};
