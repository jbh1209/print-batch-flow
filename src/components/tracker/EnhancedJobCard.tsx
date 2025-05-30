
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Clock, 
  User, 
  Calendar, 
  QrCode,
  Play,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import { useJobStageManagement } from "@/hooks/tracker/useJobStageManagement";
import { JobStageProgress } from "./JobStageProgress";
import { QRStageScanner } from "./QRStageScanner";

interface EnhancedJobCardProps {
  job: {
    id: string;
    wo_no: string;
    customer?: string;
    category?: string;
    category_id?: string;
    due_date?: string;
    status: string;
  };
  jobTableName: string;
  onJobUpdate?: () => void;
}

export const EnhancedJobCard = ({ 
  job, 
  jobTableName, 
  onJobUpdate 
}: EnhancedJobCardProps) => {
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scannerMode, setScannerMode] = useState<'start' | 'complete'>('start');
  const [selectedStage, setSelectedStage] = useState<any>(null);

  const {
    jobStages,
    isLoading,
    error,
    isProcessing,
    initializeJobWorkflow,
    startStage,
    completeStage,
    getCurrentStage,
    getWorkflowProgress
  } = useJobStageManagement({
    jobId: job.id,
    jobTableName,
    categoryId: job.category_id
  });

  const currentStage = getCurrentStage();
  const progress = getWorkflowProgress();

  const handleInitializeWorkflow = async () => {
    const success = await initializeJobWorkflow();
    if (success && onJobUpdate) {
      onJobUpdate();
    }
  };

  const handleStartStage = async (stageId: string) => {
    const success = await startStage(stageId);
    if (success && onJobUpdate) {
      onJobUpdate();
    }
  };

  const handleCompleteStage = async (stageId: string, notes?: string) => {
    const success = await completeStage(stageId, notes);
    if (success && onJobUpdate) {
      onJobUpdate();
    }
  };

  const handleQRScan = (stageId: string, mode: 'start' | 'complete' = 'start') => {
    const stage = jobStages.find(s => s.id === stageId);
    if (stage) {
      setSelectedStage(stage);
      setScannerMode(mode);
      setShowQRScanner(true);
    }
  };

  const handleQRScanComplete = async (stageId: string, qrData: any, notes?: string) => {
    if (scannerMode === 'start') {
      await handleStartStage(stageId);
    } else {
      await handleCompleteStage(stageId, notes);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'completed') return 'bg-green-100 text-green-800 border-green-200';
    if (status === 'pending') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No due date';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{job.wo_no}</CardTitle>
              {job.customer && (
                <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                  <User className="h-3 w-3" />
                  {job.customer}
                </div>
              )}
            </div>
            <Badge variant="outline" className={getStatusColor(job.status)}>
              {job.status}
            </Badge>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-gray-600">
            {job.category && (
              <span>{job.category}</span>
            )}
            {job.due_date && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(job.due_date)}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-4 text-gray-500">
              Loading workflow...
            </div>
          ) : jobStages.length === 0 ? (
            <div className="text-center py-4 space-y-3">
              <div className="text-gray-500">
                {job.category_id ? 
                  'No workflow initialized' : 
                  'No category assigned'
                }
              </div>
              {job.category_id && (
                <Button
                  onClick={handleInitializeWorkflow}
                  disabled={isProcessing}
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Initialize Workflow
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Workflow Progress Summary */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Workflow Progress</span>
                  <span className="text-gray-600">
                    {progress.completed}/{progress.total} stages
                  </span>
                </div>
                <Progress value={progress.percentage} className="w-full" />
              </div>

              {/* Current Stage Info */}
              {currentStage && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-blue-900">
                        Current: {currentStage.production_stage.name}
                      </div>
                      <div className="text-sm text-blue-700">
                        Stage {currentStage.stage_order} of {jobStages.length}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQRScan(currentStage.id, 'complete')}
                        disabled={isProcessing}
                      >
                        <QrCode className="h-3 w-3 mr-1" />
                        Scan
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleCompleteStage(currentStage.id)}
                        disabled={isProcessing}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Complete
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Full Stage Progress */}
              <JobStageProgress
                jobStages={jobStages}
                currentStage={currentStage}
                progress={progress}
                onStartStage={handleStartStage}
                onCompleteStage={handleCompleteStage}
                onQRScan={(stageId) => handleQRScan(stageId, 'start')}
                isProcessing={isProcessing}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* QR Scanner Dialog */}
      <QRStageScanner
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={handleQRScanComplete}
        stage={selectedStage}
        mode={scannerMode}
      />
    </>
  );
};
