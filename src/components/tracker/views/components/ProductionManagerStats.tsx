
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, AlertTriangle, BarChart3 } from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { getJobCounts } from "@/utils/tracker/jobCompletionUtils";

interface ProductionManagerStatsProps {
  jobs: AccessibleJob[];
}

export const ProductionManagerStats: React.FC<ProductionManagerStatsProps> = ({ jobs }) => {
  const { active: activeJobsCount, activeJobs } = getJobCounts(jobs);
  
  const pendingCount = activeJobs.filter(j => j.current_stage_status === 'pending').length;
  const inProgressCount = activeJobs.filter(j => j.proof_approved_at && j.current_stage_status !== 'completed').length;
  
  const avgProgress = activeJobs.length > 0 
    ? Math.round(activeJobs.reduce((sum, job) => sum + (job.workflow_progress || 0), 0) / activeJobs.length) 
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Eye className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm text-gray-600">Active Jobs</p>
              <p className="text-2xl font-bold">{activeJobsCount}</p>
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
              <p className="text-2xl font-bold">{pendingCount}</p>
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
              <p className="text-2xl font-bold">{inProgressCount}</p>
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
              <p className="text-2xl font-bold">{avgProgress}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
