import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { JobStageWithDetails } from "@/hooks/tracker/useRealTimeJobStages/types";
import { useConcurrentStageOperations } from "@/hooks/tracker/useConcurrentStageOperations";

interface ConcurrentStageCardProps {
  jobStages: JobStageWithDetails[];
  concurrentGroupId: string;
  onStageAction: (stageId: string, action: string) => void;
  onSelectJob?: (jobId: string) => void;
  highlighted?: boolean;
}

export const ConcurrentStageCard: React.FC<ConcurrentStageCardProps> = ({
  jobStages,
  concurrentGroupId,
  onStageAction,
  onSelectJob,
  highlighted = false
}) => {
  const { startConcurrentPrintingStages, canStartConcurrentGroup } = useConcurrentStageOperations();
  
  // Get the first job stage to represent the group
  const primaryStage = jobStages[0];
  if (!primaryStage?.production_job) return null;

  const allPending = jobStages.every(stage => stage.status === 'pending');
  const allCompleted = jobStages.every(stage => stage.status === 'completed');
  const someActive = jobStages.some(stage => stage.status === 'active');
  const someCompleted = jobStages.some(stage => stage.status === 'completed');

  const getGroupStatus = () => {
    if (allCompleted) return 'completed';
    if (someActive) return 'active';
    if (allPending) return 'pending';
    return 'mixed';
  };

  const getStatusColor = () => {
    const status = getGroupStatus();
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'active': return 'bg-blue-100 text-blue-700';
      case 'pending': return 'bg-yellow-50 text-yellow-800';
      default: return 'bg-purple-100 text-purple-700';
    }
  };

  const handleStartConcurrent = async () => {
    if (!primaryStage.production_job) return;
    
    const stageIds = jobStages.map(stage => stage.production_stage_id);
    await startConcurrentPrintingStages(
      primaryStage.job_id,
      primaryStage.job_table_name,
      stageIds
    );
  };

  const getPrimaryStageInfo = () => {
    const printingStages = jobStages.filter(stage => 
      stage.production_stage?.name?.toLowerCase().includes('printing')
    );
    return printingStages.length > 0 ? printingStages[0] : primaryStage;
  };

  const primaryInfo = getPrimaryStageInfo();

  return (
    <div 
      className={`
        bg-white rounded-lg border p-3 cursor-pointer transition-all duration-200 
        ${highlighted ? 'ring-2 ring-green-500 shadow-md' : 'hover:shadow-sm border-gray-200'}
        ${someActive ? 'border-l-4 border-l-blue-500' : ''}
        ${allCompleted ? 'border-l-4 border-l-green-500' : ''}
      `}
      onClick={() => onSelectJob && primaryStage.production_job?.id && onSelectJob(primaryStage.production_job.id)}
    >
      {/* Header with job info */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-900">
            {primaryStage.production_job.wo_no}
          </span>
          <Badge variant="outline" className={getStatusColor()}>
            {getGroupStatus() === 'mixed' ? 'In Progress' : getGroupStatus()}
          </Badge>
        </div>
        <div className="text-xs text-gray-500">
          {jobStages.length} parts
        </div>
      </div>

      {/* Customer info */}
      <div className="text-sm text-gray-600 mb-2 truncate">
        {primaryStage.production_job.customer || 'Unknown Customer'}
      </div>

      {/* Parts breakdown */}
      <div className="space-y-1 mb-3">
        {jobStages.map(stage => (
          <div key={stage.id} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: stage.production_stage.color }}
              />
              <span className="capitalize">
                {stage.part_name || stage.production_stage.name}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {stage.status === 'completed' && <CheckCircle className="h-3 w-3 text-green-600" />}
              {stage.status === 'active' && <Clock className="h-3 w-3 text-blue-600" />}
              {stage.status === 'pending' && <div className="w-3 h-3 rounded-full border border-gray-300" />}
              {stage.status === 'blocked' && <AlertTriangle className="h-3 w-3 text-orange-600" />}
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        {allPending && (
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleStartConcurrent();
            }}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            <Play className="h-3 w-3 mr-1" />
            Start All Parts
          </Button>
        )}
        
        {someActive && jobStages.map(stage => (
          stage.status === 'active' && (
            <Button
              key={stage.id}
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onStageAction(stage.id, 'complete');
              }}
              className="flex-1 border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Complete {stage.part_name}
            </Button>
          )
        ))}
      </div>

      {/* Due date indicator */}
      {primaryStage.production_job.due_date && (
        <div className="mt-2 text-xs text-gray-500 text-center">
          Due: {primaryStage.production_job.due_date}
        </div>
      )}
    </div>
  );
};