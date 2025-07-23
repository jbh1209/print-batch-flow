
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Clock, Play, AlertCircle } from "lucide-react";

interface StageInfo {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'completed' | 'on-hold';
  part_name?: string;
  stage_order: number;
}

interface StageProgressIndicatorProps {
  stages: StageInfo[];
  currentStageId?: string;
  workflowProgress?: number;
  compact?: boolean;
  showPartInfo?: boolean;
  className?: string;
}

export const StageProgressIndicator: React.FC<StageProgressIndicatorProps> = ({
  stages,
  currentStageId,
  workflowProgress = 0,
  compact = false,
  showPartInfo = true,
  className = ""
}) => {
  const getStageIcon = (status: string, isCurrent: boolean) => {
    if (isCurrent && status === 'active') {
      return <Play className="h-3 w-3 text-blue-500" />;
    }
    
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'active':
        return <Play className="h-3 w-3 text-blue-500" />;
      case 'on-hold':
        return <AlertCircle className="h-3 w-3 text-yellow-500" />;
      default:
        return <Clock className="h-3 w-3 text-gray-400" />;
    }
  };

  const getStageColor = (status: string, isCurrent: boolean) => {
    if (isCurrent) return 'bg-blue-100 border-blue-300 text-blue-800';
    
    switch (status) {
      case 'completed':
        return 'bg-green-100 border-green-300 text-green-800';
      case 'active':
        return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'on-hold':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-600';
    }
  };

  if (compact) {
    const currentStage = stages.find(s => s.id === currentStageId || s.status === 'active');
    const completedCount = stages.filter(s => s.status === 'completed').length;
    
    return (
      <div className={`space-y-1 ${className}`}>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">Progress</span>
          <span className="font-medium">{workflowProgress}%</span>
        </div>
        <Progress value={workflowProgress} className="h-1" />
        {currentStage && (
          <div className="flex items-center gap-1">
            {getStageIcon(currentStage.status, true)}
            <span className="text-xs font-medium">{currentStage.name}</span>
            {showPartInfo && currentStage.part_name && (
              <Badge variant="outline" className="text-xs">
                {currentStage.part_name}
              </Badge>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Workflow Progress</span>
        <span className="text-sm text-gray-600">{workflowProgress}%</span>
      </div>
      
      <Progress value={workflowProgress} className="h-2" />
      
      <div className="space-y-2">
        {stages.map((stage) => {
          const isCurrent = stage.id === currentStageId || stage.status === 'active';
          
          return (
            <div key={stage.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStageIcon(stage.status, isCurrent)}
                <span className="text-sm">{stage.name}</span>
                {showPartInfo && stage.part_name && (
                  <Badge variant="outline" className="text-xs">
                    {stage.part_name}
                  </Badge>
                )}
              </div>
              <Badge 
                variant="outline" 
                className={`text-xs ${getStageColor(stage.status, isCurrent)}`}
              >
                {stage.status}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
};
