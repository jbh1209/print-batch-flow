import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle, Clock, AlertTriangle, Layers } from "lucide-react";
import { JobStageWithDetails } from "@/hooks/tracker/useRealTimeJobStages/types";
import { useConcurrentStageOperations } from "@/hooks/tracker/useConcurrentStageOperations";
import { supabase } from "@/integrations/supabase/client";

interface ConcurrentStageGroupProps {
  jobStages: JobStageWithDetails[];
  concurrentGroupId: string;
  onStageAction: (stageId: string, action: string) => void;
  onSelectJob?: (jobId: string) => void;
  highlighted?: boolean;
  viewMode?: 'card' | 'list';
}

export const ConcurrentStageGroup: React.FC<ConcurrentStageGroupProps> = ({
  jobStages,
  concurrentGroupId,
  onStageAction,
  onSelectJob,
  highlighted = false,
  viewMode = 'card'
}) => {
  const { startConcurrentPrintingStages } = useConcurrentStageOperations();
  
  // Get the primary job stage to represent the group
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
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'active': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'pending': return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      default: return 'bg-purple-100 text-purple-700 border-purple-200';
    }
  };

  const handleStartConcurrent = async () => {
    if (!primaryStage.production_job) return;
    
    console.log('🚀 Starting concurrent printing group:', {
      concurrentGroupId,
      jobId: primaryStage.job_id,
      stageCount: jobStages.length
    });
    
    // Start all stages in the concurrent group
    for (const stage of jobStages) {
      if (stage.status === 'pending') {
        const success = await supabase
          .from('job_stage_instances')
          .update({
            status: 'active',
            started_at: new Date().toISOString(),
            started_by: (await supabase.auth.getUser()).data.user?.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', stage.id);
          
        if (success.error) {
          console.error('❌ Error starting stage:', success.error);
        }
      }
    }
    
    // Refresh the parent view
    jobStages.forEach(stage => onStageAction(stage.id, 'refresh'));
  };

  const handleCompleteStage = (stageId: string, partName?: string) => {
    console.log('✅ Completing concurrent stage part:', { stageId, partName });
    onStageAction(stageId, 'complete');
  };

  if (viewMode === 'list') {
    return (
      <tr className={`group hover:bg-purple-50 transition border-l-4 border-l-purple-500 ${highlighted ? 'ring-2 ring-green-500' : ''}`}>
        <td className="px-2 py-1">
          <div className="flex items-center gap-2">
            <Layers className="h-3 w-3 text-purple-600" />
            <span className="font-medium text-sm">{primaryStage.production_job.wo_no}</span>
            <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700">
              {jobStages.length} parts
            </Badge>
          </div>
        </td>
        <td className="px-2 py-1 text-sm">
          {primaryStage.production_job.customer || 'Unknown'}
        </td>
        <td className="px-2 py-1">
          <Badge className={getStatusColor()}>
            {getGroupStatus() === 'mixed' ? 'In Progress' : getGroupStatus()}
          </Badge>
        </td>
        <td className="px-2 py-1">
          <div className="flex gap-1 opacity-0 group-hover:opacity-100">
            {allPending && (
              <Button size="sm" variant="outline" onClick={handleStartConcurrent}>
                <Play className="h-3 w-3" />
              </Button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  // Card view
  return (
    <div 
      className={`
        bg-white rounded-lg border-2 border-purple-200 p-3 cursor-pointer transition-all duration-200 
        ${highlighted ? 'ring-2 ring-green-500 shadow-md' : 'hover:shadow-sm'}
        ${someActive ? 'border-l-4 border-l-blue-500' : ''}
        ${allCompleted ? 'border-l-4 border-l-green-500' : ''}
      `}
      onClick={() => onSelectJob && primaryStage.production_job?.id && onSelectJob(primaryStage.production_job.id)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-purple-600" />
          <span className="font-medium text-sm text-gray-900">
            {primaryStage.production_job.wo_no}
          </span>
          <Badge className={getStatusColor()}>
            {getGroupStatus() === 'mixed' ? 'In Progress' : getGroupStatus()}
          </Badge>
        </div>
        <div className="text-xs text-gray-500">
          {jobStages.length} parts
        </div>
      </div>

      {/* Customer */}
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
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
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
                handleCompleteStage(stage.id, stage.part_name);
              }}
              className="flex-1 border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Complete {stage.part_name || 'Part'}
            </Button>
          )
        ))}
      </div>

      {/* Due date */}
      {primaryStage.production_job.due_date && (
        <div className="mt-2 text-xs text-gray-500 text-center">
          Due: {primaryStage.production_job.due_date}
        </div>
      )}
    </div>
  );
};