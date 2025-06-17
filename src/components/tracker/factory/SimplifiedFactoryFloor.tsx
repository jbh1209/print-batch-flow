
import React, { useState, useMemo } from "react";
import { useAccessibleJobsSimple } from "@/hooks/tracker/useAccessibleJobs/useAccessibleJobsSimple";
import { useSmartPermissionDetectionSimple } from "@/hooks/tracker/useSmartPermissionDetectionSimple";
import { OperatorHeader } from "./OperatorHeader";
import { JobListLoading, JobErrorState } from "../common/JobLoadingStates";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCw, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const SimplifiedFactoryFloor = () => {
  const { highestPermission, isLoading: permissionLoading } = useSmartPermissionDetectionSimple();
  const { jobs, isLoading, error, startJob, completeJob, refreshJobs } = useAccessibleJobsSimple({
    permissionType: highestPermission
  });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Simple search filtering
  const filteredJobs = useMemo(() => {
    if (!searchQuery.trim()) return jobs;
    
    const query = searchQuery.toLowerCase();
    return jobs.filter(job => 
      job.wo_no?.toLowerCase().includes(query) ||
      job.customer?.toLowerCase().includes(query) ||
      job.reference?.toLowerCase().includes(query) ||
      job.current_stage_name?.toLowerCase().includes(query) ||
      job.display_stage_name?.toLowerCase().includes(query)
    );
  }, [jobs, searchQuery]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshJobs();
      toast.success("Jobs refreshed successfully");
    } catch (error) {
      console.error("❌ Refresh failed:", error);
      toast.error("Failed to refresh jobs");
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  if (permissionLoading || isLoading) {
    return (
      <JobListLoading 
        message="Loading jobs with simplified permissions..."
        showProgress={true}
      />
    );
  }

  if (error) {
    return (
      <JobErrorState
        error={error}
        onRetry={handleRefresh}
        onRefresh={refreshJobs}
        title="Simplified Factory Floor Error"
      />
    );
  }

  console.log('📊 Simplified Factory Floor Stats:', {
    permission: highestPermission,
    totalJobs: jobs.length,
    filteredJobs: filteredJobs.length,
    searchQuery
  });

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Header */}
      <OperatorHeader 
        title={`Simplified Factory Floor - ${highestPermission} (${jobs.length} jobs)`}
      />

      {/* Simple Controls */}
      <div className="flex-shrink-0 p-4 bg-white border-b">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Badge variant="outline" className="text-sm">
            {filteredJobs.length} jobs shown
          </Badge>
        </div>
      </div>

      {/* Simple Job List */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid gap-4">
          {filteredJobs.map((job) => (
            <Card key={job.job_id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{job.wo_no}</CardTitle>
                    <p className="text-sm text-gray-600">{job.customer}</p>
                  </div>
                  <div className="text-right">
                    <Badge 
                      variant={job.current_stage_status === 'active' ? 'default' : 'secondary'}
                      className="mb-1"
                    >
                      {job.current_stage_status}
                    </Badge>
                    <p className="text-xs text-gray-500">{job.due_date}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">{job.display_stage_name || job.current_stage_name}</p>
                    <p className="text-xs text-gray-500">{job.reference}</p>
                  </div>
                  <div className="flex gap-2">
                    {job.current_stage_status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => startJob(job.job_id)}
                        disabled={!job.user_can_work}
                      >
                        Start
                      </Button>
                    )}
                    {job.current_stage_status === 'active' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => completeJob(job.job_id)}
                        disabled={!job.user_can_work}
                      >
                        Complete
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${job.workflow_progress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {job.completed_stages}/{job.total_stages} stages complete
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {filteredJobs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchQuery ? 'No jobs match your search' : 'No jobs available'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
