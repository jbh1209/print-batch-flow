
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Clock, 
  Play, 
  CheckCircle, 
  QrCode,
  AlertTriangle 
} from "lucide-react";

interface JobStageProgressProps {
  jobStages: Array<{
    id: string;
    production_stage: {
      id: string;
      name: string;
      color: string;
    };
    stage_order: number;
    status: 'pending' | 'active' | 'completed' | 'skipped';
    started_at?: string;
    completed_at?: string;
  }>;
  currentStage?: any;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  onStartStage: (stageId: string) => void;
  onCompleteStage: (stageId: string) => void;
  onQRScan: (stageId: string) => void;
  isProcessing: boolean;
}

export const JobStageProgress: React.FC<JobStageProgressProps> = ({
  jobStages,
  currentStage,
  progress,
  onStartStage,
  onCompleteStage,
  onQRScan,
  isProcessing
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-3 w-3 text-green-600" />;
      case 'active':
        return <Play className="h-3 w-3 text-blue-600" />;
      case 'pending':
        return <Clock className="h-3 w-3 text-gray-400" />;
      case 'skipped':
        return <AlertTriangle className="h-3 w-3 text-yellow-600" />;
      default:
        return <Clock className="h-3 w-3 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'active':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      case 'skipped':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  if (jobStages.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 text-sm">
        No workflow stages configured
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Progress Summary */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">Progress</span>
          <span className="text-gray-600">
            {progress.completed}/{progress.total} complete
          </span>
        </div>
        <Progress value={progress.percentage} className="h-2" />
      </div>

      {/* Stage List */}
      <div className="space-y-2">
        {jobStages
          .sort((a, b) => a.stage_order - b.stage_order)
          .map((stage) => (
            <div
              key={stage.id}
              className={`flex items-center justify-between p-2 rounded border text-sm ${
                stage.status === 'active' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2 flex-1">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: stage.production_stage.color }}
                />
                <span className="font-medium text-xs">
                  {stage.stage_order}. {stage.production_stage.name}
                </span>
                <Badge variant="outline" className={`${getStatusColor(stage.status)} text-xs`}>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(stage.status)}
                    {stage.status}
                  </div>
                </Badge>
              </div>

              <div className="flex gap-1">
                {stage.status === 'pending' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onQRScan(stage.id)}
                      disabled={isProcessing}
                      className="h-6 px-2 text-xs"
                    >
                      <QrCode className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onStartStage(stage.id)}
                      disabled={isProcessing}
                      className="h-6 px-2 text-xs"
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  </>
                )}
                
                {stage.status === 'active' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onQRScan(stage.id)}
                      disabled={isProcessing}
                      className="h-6 px-2 text-xs"
                    >
                      <QrCode className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onCompleteStage(stage.id)}
                      disabled={isProcessing}
                      className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
