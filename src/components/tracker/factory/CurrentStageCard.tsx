
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Clock, 
  CheckCircle,
  AlertTriangle,
  Play
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface StatusBadgeInfo {
  text: string;
  className: string;
  variant: "default" | "destructive" | "secondary" | "outline";
}

interface CurrentStageCardProps {
  job: AccessibleJob;
  statusInfo: StatusBadgeInfo;
}

export const CurrentStageCard: React.FC<CurrentStageCardProps> = ({ 
  job, 
  statusInfo 
}) => {
  // Get appropriate icon based on status
  const getStatusIcon = (text: string) => {
    if (text.includes('Progress')) return <Clock className="h-4 w-4" />;
    if (text.includes('Completed')) return <CheckCircle className="h-4 w-4" />;
    if (text.includes('Overdue')) return <AlertTriangle className="h-4 w-4" />;
    return <Play className="h-4 w-4" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Current Stage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: job.current_stage_color || '#6B7280' }}
            />
            <div>
              <h3 className="font-semibold text-lg">
                {job.current_stage_name || 'No Stage Assigned'}
              </h3>
              <p className="text-sm text-gray-600">
                Stage {job.completed_stages + 1} of {job.total_stages}
              </p>
            </div>
          </div>
          
          <Badge 
            className={cn(statusInfo.className)}
            variant={statusInfo.variant}
          >
            {getStatusIcon(statusInfo.text)}
            <span className="ml-1">{statusInfo.text}</span>
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Workflow Progress</span>
            <span className="text-sm font-bold text-gray-900">{job.workflow_progress}%</span>
          </div>
          <Progress value={job.workflow_progress} className="h-2" />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-green-600">{job.completed_stages}</div>
            <div className="text-xs text-gray-600">Completed</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-blue-600">
              {job.total_stages - job.completed_stages}
            </div>
            <div className="text-xs text-gray-600">Remaining</div>
          </div>
        </div>

        {/* Permissions Display */}
        <div className="pt-3 border-t">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Your Permissions</h4>
          <div className="flex flex-wrap gap-2">
            {job.user_can_view && (
              <Badge variant="secondary" className="text-xs">View</Badge>
            )}
            {job.user_can_edit && (
              <Badge variant="secondary" className="text-xs">Edit</Badge>
            )}
            {job.user_can_work && (
              <Badge variant="default" className="text-xs bg-green-600">Work</Badge>
            )}
            {job.user_can_manage && (
              <Badge variant="default" className="text-xs bg-blue-600">Manage</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
