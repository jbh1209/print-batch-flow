
import React from "react";
import { 
  FileText,
  Play,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface DtpDashboardStatsProps {
  dtpJobs: AccessibleJob[];
  proofJobs: AccessibleJob[];
}

export const DtpDashboardStats: React.FC<DtpDashboardStatsProps> = ({
  dtpJobs,
  proofJobs
}) => {
  const allJobs = [...dtpJobs, ...proofJobs];
  
  const urgentJobsCount = allJobs.filter(j => {
    const isOverdue = j.due_date && new Date(j.due_date) < new Date();
    const isDueSoon = j.due_date && !isOverdue && 
      new Date(j.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    return isOverdue || isDueSoon;
  }).length;

  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="bg-white p-3 rounded-lg border">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium">DTP Queue</span>
        </div>
        <div className="text-2xl font-bold text-blue-600">
          {dtpJobs.filter(j => j.current_stage_status === 'pending').length}
        </div>
        <div className="text-xs text-gray-500">Available to start</div>
      </div>
      
      <div className="bg-white p-3 rounded-lg border">
        <div className="flex items-center gap-2">
          <Play className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium">DTP Active</span>
        </div>
        <div className="text-2xl font-bold text-green-600">
          {dtpJobs.filter(j => j.current_stage_status === 'active').length}
        </div>
        <div className="text-xs text-gray-500">In progress</div>
      </div>
      
      <div className="bg-white p-3 rounded-lg border">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-purple-600" />
          <span className="text-sm font-medium">Proof Queue</span>
        </div>
        <div className="text-2xl font-bold text-purple-600">
          {proofJobs.filter(j => j.current_stage_status === 'pending').length}
        </div>
        <div className="text-xs text-gray-500">Ready for proofing</div>
      </div>
      
      <div className="bg-white p-3 rounded-lg border">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <span className="text-sm font-medium">Urgent</span>
        </div>
        <div className="text-2xl font-bold text-orange-600">
          {urgentJobsCount}
        </div>
        <div className="text-xs text-gray-500">Due soon/overdue</div>
      </div>
    </div>
  );
};
