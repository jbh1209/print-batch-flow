
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Package,
  Clock
} from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface CurrentStageCardProps {
  job: AccessibleJob;
  statusInfo: {
    color: string;
    bg: string;
    border: string;
    text: string;
    icon: React.ReactNode;
  };
}

export const CurrentStageCard: React.FC<CurrentStageCardProps> = ({ 
  job, 
  statusInfo 
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Package className="h-5 w-5" />
          Current Stage
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold">{job.current_stage_name || 'Unknown Stage'}</p>
            <p className="text-sm text-gray-600">
              Status: <span className={statusInfo.color}>{statusInfo.text}</span>
            </p>
          </div>
          {job.current_stage_status === 'active' && (
            <div className="flex items-center gap-2 text-green-600">
              <Clock className="h-4 w-4 animate-pulse" />
              <span className="text-sm font-medium">Timer Running</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
