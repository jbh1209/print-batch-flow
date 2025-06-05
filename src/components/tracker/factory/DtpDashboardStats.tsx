
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  CheckCircle,
  FileText,
  Users
} from "lucide-react";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs/types";
import type { DashboardMetrics } from "@/hooks/tracker/useAccessibleJobs/dashboardUtils";

interface DtpDashboardStatsProps {
  dtpJobs: AccessibleJob[];
  proofJobs: AccessibleJob[];
  metrics?: DashboardMetrics;
}

export const DtpDashboardStats: React.FC<DtpDashboardStatsProps> = ({ 
  dtpJobs, 
  proofJobs, 
  metrics 
}) => {
  // Calculate DTP-specific metrics
  const dtpActive = dtpJobs.filter(j => j.current_stage_status === 'active').length;
  const dtpPending = dtpJobs.filter(j => j.current_stage_status === 'pending').length;
  const proofActive = proofJobs.filter(j => j.current_stage_status === 'active').length;
  const proofPending = proofJobs.filter(j => j.current_stage_status === 'pending').length;

  const dtpUrgent = dtpJobs.filter(j => {
    if (!j.due_date) return false;
    const dueDate = new Date(j.due_date);
    const now = new Date();
    return dueDate <= new Date(now.getTime() + 24 * 60 * 60 * 1000); // Due within 24 hours
  }).length;

  const proofUrgent = proofJobs.filter(j => {
    if (!j.due_date) return false;
    const dueDate = new Date(j.due_date);
    const now = new Date();
    return dueDate <= new Date(now.getTime() + 24 * 60 * 60 * 1000); // Due within 24 hours
  }).length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* DTP Jobs Summary */}
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">DTP Jobs</p>
              <p className="text-2xl font-bold text-blue-900">{dtpJobs.length}</p>
              <div className="flex gap-1 mt-1">
                <Badge variant="outline" className="text-xs bg-blue-600 text-white">
                  {dtpActive} Active
                </Badge>
                {dtpUrgent > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {dtpUrgent} Urgent
                  </Badge>
                )}
              </div>
            </div>
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
        </CardContent>
      </Card>

      {/* Proof Jobs Summary */}
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Proof Jobs</p>
              <p className="text-2xl font-bold text-purple-900">{proofJobs.length}</p>
              <div className="flex gap-1 mt-1">
                <Badge variant="outline" className="text-xs bg-purple-600 text-white">
                  {proofActive} Active
                </Badge>
                {proofUrgent > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {proofUrgent} Urgent
                  </Badge>
                )}
              </div>
            </div>
            <CheckCircle className="h-8 w-8 text-purple-600" />
          </div>
        </CardContent>
      </Card>

      {/* Total Pending */}
      <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600">Pending Work</p>
              <p className="text-2xl font-bold text-orange-900">{dtpPending + proofPending}</p>
              <p className="text-xs text-orange-700 mt-1">
                {dtpPending} DTP, {proofPending} Proof
              </p>
            </div>
            <Clock className="h-8 w-8 text-orange-600" />
          </div>
        </CardContent>
      </Card>

      {/* Overall Progress */}
      <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Progress</p>
              <p className="text-2xl font-bold text-green-900">
                {metrics?.averageProgress || 0}%
              </p>
              <p className="text-xs text-green-700 mt-1">
                Average completion
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
