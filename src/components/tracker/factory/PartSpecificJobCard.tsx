
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle } from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface PartSpecificJobCardProps {
  job: AccessibleJob;
  partType?: string;
  onStartStage: (jobId: string, stageId: string) => void;
  onCompleteStage: (jobId: string, stageId: string) => void;
  canStart: boolean;
  canComplete: boolean;
}

export const PartSpecificJobCard: React.FC<PartSpecificJobCardProps> = ({
  job,
  partType,
  onStartStage,
  onCompleteStage,
  canStart,
  canComplete
}) => {
  const getPartDisplayName = (part?: string) => {
    if (!part) return '';
    return part.charAt(0).toUpperCase() + part.slice(1);
  };

  const getPartBadgeColor = (part?: string) => {
    if (!part) return "bg-gray-100 text-gray-800";
    if (part.toLowerCase() === 'cover') return "bg-blue-100 text-blue-800 border-blue-200";
    if (part.toLowerCase() === 'text') return "bg-green-100 text-green-800 border-green-200";
    return "bg-purple-100 text-purple-800 border-purple-200";
  };

  const getStatusBadge = () => {
    const status = job.status;
    let variant: "default" | "secondary" | "destructive" | "outline" = "default";
    let color = "";

    if (status.includes('Progress')) {
      variant = "default";
      color = "bg-blue-100 text-blue-800 border-blue-200";
    } else if (status.includes('Ready')) {
      variant = "secondary";
      color = "bg-green-100 text-green-800 border-green-200";
    } else if (status.includes('Awaiting')) {
      variant = "outline";
      color = "bg-orange-100 text-orange-800 border-orange-200";
    }

    return (
      <Badge variant={variant} className={color}>
        {status}
      </Badge>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>{job.wo_no}</span>
            {partType && (
              <Badge className={getPartBadgeColor(partType)}>
                {getPartDisplayName(partType)}
              </Badge>
            )}
          </div>
          {getStatusBadge()}
        </CardTitle>
        <div className="text-sm text-gray-600">
          <p><strong>Customer:</strong> {job.customer}</p>
          <p><strong>Stage:</strong> {job.current_stage_name}</p>
          <p><strong>Due:</strong> {job.due_date ? new Date(job.due_date).toLocaleDateString() : 'Not set'}</p>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {canStart && (
          <Button 
            onClick={() => onStartStage(job.job_id, job.current_stage_id)}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            <Play className="h-4 w-4 mr-2" />
            Start {partType ? `${getPartDisplayName(partType)} ` : ''}Printing
          </Button>
        )}
        
        {canComplete && (
          <Button 
            onClick={() => onCompleteStage(job.job_id, job.current_stage_id)}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Complete {partType ? `${getPartDisplayName(partType)} ` : ''}Printing
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
