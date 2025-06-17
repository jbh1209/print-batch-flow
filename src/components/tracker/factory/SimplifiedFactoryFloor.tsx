
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const SimplifiedFactoryFloor = () => {
  const { highestPermission, isLoading: permissionLoading } = useSmartPermissionDetectionSimple();
  const { jobs, isLoading, error, startJob, completeJob, refreshJobs } = useAccessibleJobsSimple({
    permissionType: highestPermission
  });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Group jobs by master queue
  const jobsByMasterQueue = useMemo(() => {
    const grouped = jobs.reduce((acc, job) => {
      const queueName = job.display_stage_name || job.current_stage_name || 'Unknown Queue';
      if (!acc[queueName]) {
        acc[queueName] = [];
      }
      acc[queueName].push(job);
      return acc;
    }, {} as Record<string, typeof jobs>);
    
    console.log('🎯 Jobs grouped by master queue:', {
      totalJobs: jobs.length,
      grouped: Object.keys(grouped).map(queue => ({
        queue,
        count: grouped[queue].length
      }))
    });
    
    return grouped;
  }, [jobs]);

  // Simple search filtering across all jobs
  const filteredJobsByQueue = useMemo(() => {
    if (!searchQuery.trim()) return jobsByMasterQueue;
    
    const query = searchQuery.toLowerCase();
    const filtered: Record<string, typeof jobs> = {};
    
    Object.entries(jobsByMasterQueue).forEach(([queueName, queueJobs]) => {
      const filteredJobs = queueJobs.filter(job => 
        job.wo_no?.toLowerCase().includes(query) ||
        job.customer?.toLowerCase().includes(query) ||
        job.reference?.toLowerCase().includes(query) ||
        job.current_stage_name?.toLowerCase().includes(query) ||
        job.display_stage_name?.toLowerCase().includes(query)
      );
      
      if (filteredJobs.length > 0) {
        filtered[queueName] = filteredJobs;
      }
    });
    
    return filtered;
  }, [jobsByMasterQueue, searchQuery]);

  const totalFilteredJobs = useMemo(() => {
    return Object.values(filteredJobsByQueue).reduce((total, queueJobs) => total + queueJobs.length, 0);
  }, [filteredJobsByQueue]);

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

  console.log('📊 Simplified Factory Floor Debug:', {
    permission: highestPermission,
    totalJobsFromDB: jobs.length,
    filteredTotalJobs: totalFilteredJobs,
    queueCount: Object.keys(filteredJobsByQueue).length,
    searchQuery,
    masterQueues: Object.keys(jobsByMasterQueue)
  });

  const queueNames = Object.keys(filteredJobsByQueue);
  const defaultQueue = queueNames[0] || 'all';

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Header */}
      <OperatorHeader 
        title={`Factory Floor - ${highestPermission} (${jobs.length} total jobs)`}
      />

      {/* Controls */}
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
            {totalFilteredJobs} jobs shown
          </Badge>
        </div>
      </div>

      {/* Master Queue Tabs */}
      <div className="flex-1 overflow-hidden">
        {queueNames.length > 1 ? (
          <Tabs defaultValue={defaultQueue} className="h-full flex flex-col">
            <div className="flex-shrink-0 px-4 pt-2 bg-white border-b">
              <TabsList className="grid w-full grid-cols-3">
                {queueNames.slice(0, 3).map((queueName) => (
                  <TabsTrigger key={queueName} value={queueName} className="text-xs">
                    {queueName} ({filteredJobsByQueue[queueName].length})
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            
            {queueNames.slice(0, 3).map((queueName) => (
              <TabsContent key={queueName} value={queueName} className="flex-1 overflow-auto p-4 mt-0">
                <JobQueueSection
                  queueName={queueName}
                  jobs={filteredJobsByQueue[queueName]}
                  onStart={startJob}
                  onComplete={completeJob}
                />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="flex-1 overflow-auto p-4">
            <JobQueueSection
              queueName={queueNames[0] || 'All Jobs'}
              jobs={Object.values(filteredJobsByQueue).flat()}
              onStart={startJob}
              onComplete={completeJob}
            />
          </div>
        )}
      </div>
    </div>
  );
};

interface JobQueueSectionProps {
  queueName: string;
  jobs: any[];
  onStart: (jobId: string) => Promise<boolean>;
  onComplete: (jobId: string) => Promise<boolean>;
}

const JobQueueSection: React.FC<JobQueueSectionProps> = ({ queueName, jobs, onStart, onComplete }) => {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No jobs in {queueName}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{queueName}</h2>
        <Badge variant="secondary">{jobs.length} jobs</Badge>
      </div>
      
      <div className="grid gap-4">
        {jobs.map((job) => (
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
                      onClick={() => onStart(job.job_id)}
                      disabled={!job.user_can_work}
                    >
                      Start
                    </Button>
                  )}
                  {job.current_stage_status === 'active' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onComplete(job.job_id)}
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
    </div>
  );
};
