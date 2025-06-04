
import React from "react";
import { 
  FileText,
  Play,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { categorizeJobs, calculateJobCounts } from "@/hooks/tracker/useAccessibleJobs/jobStatusProcessor";

interface DtpDashboardStatsProps {
  dtpJobs: AccessibleJob[];
  proofJobs: AccessibleJob[];
}

export const DtpDashboardStats: React.FC<DtpDashboardStatsProps> = ({
  dtpJobs,
  proofJobs
}) => {
  // Use consistent job categorization
  const dtpCategories = categorizeJobs(dtpJobs);
  const proofCategories = categorizeJobs(proofJobs);
  const allJobsCategories = categorizeJobs([...dtpJobs, ...proofJobs]);

  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="bg-white p-3 rounded-lg border">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium">DTP Queue</span>
        </div>
        <div className="text-2xl font-bold text-blue-600">
          {dtpCategories.pendingJobs.length}
        </div>
        <div className="text-xs text-gray-500">Available to start</div>
      </div>
      
      <div className="bg-white p-3 rounded-lg border">
        <div className="flex items-center gap-2">
          <Play className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium">DTP Active</span>
        </div>
        <div className="text-2xl font-bold text-green-600">
          {dtpCategories.activeJobs.length}
        </div>
        <div className="text-xs text-gray-500">In progress</div>
      </div>
      
      <div className="bg-white p-3 rounded-lg border">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-purple-600" />
          <span className="text-sm font-medium">Proof Queue</span>
        </div>
        <div className="text-2xl font-bold text-purple-600">
          {proofCategories.pendingJobs.length}
        </div>
        <div className="text-xs text-gray-500">Ready for proofing</div>
      </div>
      
      <div className="bg-white p-3 rounded-lg border">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <span className="text-sm font-medium">Urgent</span>
        </div>
        <div className="text-2xl font-bold text-orange-600">
          {allJobsCategories.urgentJobs.length}
        </div>
        <div className="text-xs text-gray-500">Due soon/overdue</div>
      </div>
    </div>
  );
};
