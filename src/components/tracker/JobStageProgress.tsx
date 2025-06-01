
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Play, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  QrCode, 
  RotateCcw,
  History
} from "lucide-react";
import { StageReworkDialog } from "./jobs/StageReworkDialog";
import { useJobStageManagement } from "@/hooks/tracker/useJobStageManagement";

interface JobStageProgressProps {
  job: {
    id: string;
    wo_no: string;
    category_id?: string;
  };
  jobTableName: string;
  onStageAction?: (action: string, stageId: string) => void;
}

export const JobStageProgress: React.FC<JobStageProgressProps> = ({
  job,
  jobTableName,
  onStageAction
}) => {
  const [reworkDialogOpen, setReworkDialogOpen] = useState(false);
  const [selectedTargetStage, setSelectedTargetStage] = useState<any>(null);

  const {
    jobStages,
    isLoading,
    isProcessing,
    startStage,
    completeStage,
    sendBackForRework,
    getCurrentStage,
    getAvailableReworkStages,
    canAdvanceStage,
    canReworkStage,
    getWorkflowProgress,
    reworkHistory
  } = useJobStageManagement({
    jobId: job.id,
    jobTableName,
    categoryId: job.category_id
  });

  const currentStage = getCurrentStage();
  const progress = getWorkflowProgress();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'active':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      case 'reworked':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'active':
        return <Play className="h-4 w-4 text-blue-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-400" />;
      case 'reworked':
        return <RotateCcw className="h-4 w-4 text-orange-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const handleStageStart = async (stageId: string) => {
    const success = await startStage(stageId);
    if (success) {
      onStageAction?.('start', stageId);
    }
  };

  const handleStageComplete = async (stageId: string) => {
    const success = await completeStage(stageId);
    if (success) {
      onStageAction?.('complete', stageId);
    }
  };

  const handleReworkRequest = (targetStage: any) => {
    setSelectedTargetStage(targetStage);
    setReworkDialogOpen(true);
  };

  const handleReworkConfirm = async (reason: string) => {
    if (!currentStage || !selectedTargetStage) return;

    const success = await sendBackForRework(
      currentStage.production_stage_id,
      selectedTargetStage.production_stage_id,
      reason
    );

    if (success) {
      setReworkDialogOpen(false);
      setSelectedTargetStage(null);
      onStageAction?.('rework', currentStage.production_stage_id);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading workflow...</div>
        </CardContent>
      </Card>
    );
  }

  if (jobStages.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            No workflow initialized for this job
          </div>
        </CardContent>
      </Card>
    );
  }

  const availableReworkStages = currentStage ? getAvailableReworkStages(currentStage.production_stage_id) : [];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">Workflow Progress</CardTitle>
            <div className="flex items-center gap-2">
              {reworkHistory.length > 0 && (
                <Badge variant="outline" className="text-orange-600">
                  <History className="h-3 w-3 mr-1" />
                  {reworkHistory.length} rework{reworkHistory.length !== 1 ? 's' : ''}
                </Badge>
              )}
              <Badge variant="outline">
                {progress.completed}/{progress.total} Complete
              </Badge>
            </div>
          </div>
          <Progress value={progress.percentage} className="w-full" />
        </CardHeader>
        
        <CardContent className="space-y-4">
          {jobStages.map((stage, index) => (
            <div
              key={stage.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                stage.status === 'active' ? 'ring-2 ring-blue-300 bg-blue-50' : 'bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-500">
                    {index + 1}.
                  </span>
                  <Badge 
                    variant="outline" 
                    className={getStatusColor(stage.status)}
                  >
                    <div className="flex items-center gap-1">
                      {getStatusIcon(stage.status)}
                      {stage.status}
                    </div>
                  </Badge>
                </div>
                
                <div>
                  <div className="font-medium">{stage.production_stage.name}</div>
                  {(stage.rework_count || 0) > 0 && (
                    <div className="text-xs text-orange-600">
                      Reworked {stage.rework_count} time{stage.rework_count !== 1 ? 's' : ''}
                    </div>
                  )}
                  {stage.rework_reason && (
                    <div className="text-xs text-gray-500 mt-1">
                      Last rework: {stage.rework_reason}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {stage.status === 'pending' && (
                  <Button
                    size="sm"
                    onClick={() => handleStageStart(stage.id)}
                    disabled={isProcessing}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Start
                  </Button>
                )}

                {stage.status === 'active' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onStageAction?.('qr-scan', stage.id)}
                    >
                      <QrCode className="h-3 w-3 mr-1" />
                      Scan
                    </Button>
                    
                    {availableReworkStages.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-orange-600 border-orange-200 hover:bg-orange-50"
                        onClick={() => {
                          // For now, send back to previous stage. Could be enhanced to show stage selection
                          const previousStage = availableReworkStages[availableReworkStages.length - 1];
                          handleReworkRequest(previousStage);
                        }}
                        disabled={isProcessing}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Send Back
                      </Button>
                    )}
                    
                    <Button
                      size="sm"
                      onClick={() => handleStageComplete(stage.id)}
                      disabled={isProcessing || !canAdvanceStage(stage.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Complete
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Rework Dialog */}
      {selectedTargetStage && (
        <StageReworkDialog
          isOpen={reworkDialogOpen}
          onClose={() => {
            setReworkDialogOpen(false);
            setSelectedTargetStage(null);
          }}
          currentStage={{
            id: currentStage?.production_stage_id || '',
            name: currentStage?.production_stage.name || '',
            color: currentStage?.production_stage.color || '#6B7280'
          }}
          targetStage={{
            id: selectedTargetStage.production_stage_id,
            name: selectedTargetStage.production_stage.name,
            color: selectedTargetStage.production_stage.color
          }}
          jobNumber={job.wo_no}
          onConfirm={handleReworkConfirm}
          isLoading={isProcessing}
        />
      )}
    </>
  );
};
