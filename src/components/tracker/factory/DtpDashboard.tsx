
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  RefreshCw, 
  Play, 
  CheckCircle, 
  Clock,
  Users,
  AlertTriangle
} from "lucide-react";
import { CompactDtpJobCard } from "./CompactDtpJobCard";
import { DtpJobModal } from "./DtpJobModal";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { 
  categorizeJobs, 
  calculateJobCounts,
  sortJobsByPriority
} from "@/hooks/tracker/useAccessibleJobs/pureJobProcessor";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs/types";

export const DtpDashboard: React.FC = () => {
  const { user } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [selectedJob, setSelectedJob] = useState<AccessibleJob | null>(null);
  const [showJobModal, setShowJobModal] = useState(false);
  
  const { 
    jobs, 
    isLoading, 
    error, 
    startJob, 
    completeJob, 
    refreshJobs 
  } = useAccessibleJobs({
    permissionType: 'work'
  });

  useEffect(() => {
    const debugUserAccess = async () => {
      if (!user?.id) return;
      
      console.log('🔍 DTP Dashboard Debug - Starting user access check for:', user.id);
      
      try {
        const { data: userGroups, error: groupError } = await supabase
          .from('user_group_memberships')
          .select(`
            group_id,
            user_groups (
              id,
              name,
              description
            )
          `)
          .eq('user_id', user.id);

        const { data: stagePermissions, error: permError } = await supabase
          .from('user_group_stage_permissions')
          .select(`
            production_stage_id,
            can_view,
            can_edit,
            can_work,
            can_manage,
            production_stages (
              id,
              name,
              color
            )
          `)
          .in('user_group_id', userGroups?.map(ug => ug.group_id) || []);

        const { data: jobInstances, error: instanceError } = await supabase
          .from('job_stage_instances')
          .select(`
            job_id,
            production_stage_id,
            status,
            job_table_name
          `)
          .eq('job_table_name', 'production_jobs')
          .in('status', ['active', 'pending']);

        const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_accessible_jobs', {
          p_user_id: user.id,
          p_permission_type: 'work'
        });

        const debug = {
          userId: user.id,
          userEmail: user.email,
          userGroups: userGroups?.length || 0,
          userGroupDetails: userGroups?.map(ug => ({
            id: ug.group_id,
            name: ug.user_groups?.name
          })) || [],
          stagePermissions: stagePermissions?.length || 0,
          workableStages: stagePermissions?.filter(sp => sp.can_work)?.length || 0,
          jobInstances: jobInstances?.length || 0,
          rpcResult: rpcData?.length || 0,
          rpcError: rpcError?.message || null,
          hookJobs: jobs.length,
          hookError: error
        };

        console.log('🔍 DTP Dashboard Debug Results:', debug);
        setDebugInfo(debug);

      } catch (err) {
        console.error('❌ Debug error:', err);
        setDebugInfo({ error: err.message });
      }
    };

    debugUserAccess();
  }, [user?.id, jobs.length, error]);

  const jobCategories = React.useMemo(() => {
    try {
      return categorizeJobs(jobs);
    } catch (error) {
      console.error("Error categorizing jobs:", error);
      return { pendingJobs: [], activeJobs: [], completedJobs: [], urgentJobs: [], dtpJobs: [], proofJobs: [] };
    }
  }, [jobs]);

  const jobStats = React.useMemo(() => {
    try {
      return calculateJobCounts(jobs);
    } catch (error) {
      console.error("Error calculating job stats:", error);
      return { total: 0, pending: 0, active: 0, completed: 0, overdue: 0, dueSoon: 0 };
    }
  }, [jobs]);

  const sortedJobs = React.useMemo(() => {
    try {
      return sortJobsByPriority(jobs);
    } catch (error) {
      console.error("Error sorting jobs:", error);
      return jobs;
    }
  }, [jobs]);

  console.log('🎯 DTP Dashboard Job Categories:', {
    totalJobs: jobs.length,
    pending: jobStats.pending,
    active: jobStats.active,
    completed: jobStats.completed
  });

  const handleJobClick = (job: AccessibleJob) => {
    console.log('🖱️ Job clicked:', job.wo_no);
    setSelectedJob(job);
    setShowJobModal(true);
  };

  const handleCloseModal = () => {
    setShowJobModal(false);
    setSelectedJob(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin mr-2" />
            <span>Loading DTP jobs...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <AlertTriangle className="h-8 w-8 text-red-500 mr-2" />
            <div>
              <p className="font-medium">Error loading jobs</p>
              <p className="text-sm text-gray-600">{error}</p>
              <Button 
                onClick={refreshJobs} 
                variant="outline" 
                size="sm" 
                className="mt-2"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">DTP Dashboard</h1>
          <p className="text-gray-600">Digital printing jobs you can work on</p>
        </div>
        <Button onClick={refreshJobs} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobStats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <Play className="h-4 w-4 mr-1 text-green-600" />
              Ready to Start
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{jobStats.pending}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <Clock className="h-4 w-4 mr-1 text-blue-600" />
              In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{jobStats.active}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <CheckCircle className="h-4 w-4 mr-1 text-gray-600" />
              Completed Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{jobStats.completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Debug Information */}
      {debugInfo && process.env.NODE_ENV === 'development' && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-sm text-amber-800 flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Debug Information
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-amber-700">
            <div className="grid grid-cols-2 gap-2">
              <div>User ID: {debugInfo.userId}</div>
              <div>Email: {debugInfo.userEmail}</div>
              <div>User Groups: {debugInfo.userGroups}</div>
              <div>Stage Permissions: {debugInfo.stagePermissions}</div>
              <div>Workable Stages: {debugInfo.workableStages}</div>
              <div>Job Instances: {debugInfo.jobInstances}</div>
              <div>RPC Result: {debugInfo.rpcResult}</div>
              <div>Hook Jobs: {debugInfo.hookJobs}</div>
            </div>
            {debugInfo.rpcError && (
              <div className="mt-2 p-2 bg-red-100 rounded text-red-700">
                RPC Error: {debugInfo.rpcError}
              </div>
            )}
            {debugInfo.hookError && (
              <div className="mt-2 p-2 bg-red-100 rounded text-red-700">
                Hook Error: {debugInfo.hookError}
              </div>
            )}
            {debugInfo.userGroupDetails && debugInfo.userGroupDetails.length > 0 && (
              <div className="mt-2">
                <strong>Groups:</strong> {debugInfo.userGroupDetails.map(g => g.name).join(', ')}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Jobs Available</h3>
            <p className="text-gray-600 text-center max-w-md">
              There are currently no DTP jobs that you have permission to work on. 
              Check with your administrator if you think this is incorrect.
            </p>
            {debugInfo && (
              <div className="mt-4 text-sm text-gray-500">
                Debug: {debugInfo.userGroups} groups, {debugInfo.workableStages} workable stages
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {jobCategories.pendingJobs.length > 0 && (
            <div>
              <h2 className="text-lg font-medium mb-4 flex items-center">
                <Play className="h-5 w-5 mr-2 text-green-600" />
                Ready to Start ({jobCategories.pendingJobs.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {jobCategories.pendingJobs.map((job) => (
                  <CompactDtpJobCard
                    key={job.job_id}
                    job={job}
                    onStart={startJob}
                    onComplete={completeJob}
                    onJobClick={handleJobClick}
                    showActions={true}
                  />
                ))}
              </div>
            </div>
          )}

          {jobCategories.activeJobs.length > 0 && (
            <div>
              <h2 className="text-lg font-medium mb-4 flex items-center">
                <Clock className="h-5 w-5 mr-2 text-blue-600" />
                In Progress ({jobCategories.activeJobs.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {jobCategories.activeJobs.map((job) => (
                  <CompactDtpJobCard
                    key={job.job_id}
                    job={job}
                    onStart={startJob}
                    onComplete={completeJob}
                    onJobClick={handleJobClick}
                    showActions={true}
                  />
                ))}
              </div>
            </div>
          )}

          {jobCategories.completedJobs.length > 0 && (
            <div>
              <h2 className="text-lg font-medium mb-4 flex items-center">
                <CheckCircle className="h-5 w-5 mr-2 text-gray-600" />
                Completed Today ({jobCategories.completedJobs.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {jobCategories.completedJobs.slice(0, 6).map((job) => (
                  <CompactDtpJobCard
                    key={job.job_id}
                    job={job}
                    onStart={startJob}
                    onComplete={completeJob}
                    onJobClick={handleJobClick}
                    showActions={false}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedJob && (
        <DtpJobModal
          job={selectedJob}
          isOpen={showJobModal}
          onClose={handleCloseModal}
          onStart={startJob}
          onComplete={completeJob}
        />
      )}
    </div>
  );
};
