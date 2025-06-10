
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, AlertTriangle, BarChart3 } from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface ProductionManagerStatsProps {
  jobs: AccessibleJob[];
}

export const ProductionManagerStats: React.FC<ProductionManagerStatsProps> = ({ jobs }) => {
  const pendingCount = jobs.filter(j => j.current_stage_status === 'pending').length;
  const activeCount = jobs.filter(j => j.current_stage_status === 'active').length;
  const avgProgress = jobs.length > 0 
    ? Math.round(jobs.reduce((sum, job) => sum + job.workflow_progress, 0) / jobs.length) 
    : 0;

  return (
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
              <p className="text-2xl font-bold">{activeCount}</p>
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
