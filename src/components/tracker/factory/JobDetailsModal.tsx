import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Calendar,
  Clock,
  Package,
  MapPin,
  Hash,
  AlertTriangle,
  CheckCircle,
  Timer,
  QrCode,
  FileText,
  Printer,
  Play,
  Pause
} from "lucide-react";
import { format } from "date-fns";
import { ScheduledJobStage } from "@/hooks/tracker/useScheduledJobs";
import { useJobSpecificationDisplay } from "@/hooks/useJobSpecificationDisplay";
import { PrintSpecsBadge } from "./PrintSpecsBadge";
import StageHoldDialog from "./StageHoldDialog";
import { useStageActions } from "@/hooks/tracker/stage-management/useStageActions";
import { toast } from "sonner";

// Normalize status variants from backend
const normalizeStatus = (status?: string): 'pending' | 'active' | 'completed' | 'skipped' | 'on_hold' => {
  if (status === 'in_progress') return 'active';
  if (!status) return 'pending';
  return status as 'pending' | 'active' | 'completed' | 'skipped' | 'on_hold';
};

interface JobDetailsModalProps {
  job: ScheduledJobStage | null;
  isOpen: boolean;
  onClose: () => void;
  onStartJob?: (jobId: string) => void;
  onCompleteJob?: (jobId: string) => void;
}

export const JobDetailsModal: React.FC<JobDetailsModalProps> = ({
  job,
  isOpen,
  onClose,
  onStartJob,
  onCompleteJob
}) => {
  const [showHoldDialog, setShowHoldDialog] = useState(false);
  const { holdStage, resumeStage, isProcessing: stageActionsProcessing } = useStageActions();
  const { isLoading: specsLoading, error: specsError, getSize, getPaperType, getPaperWeight, getLamination } = useJobSpecificationDisplay(job?.job_id, job ? 'production_jobs' : undefined);

  const sheetSize = getSize();
  const paperType = getPaperType();
  const paperWeight = getPaperWeight();
  const paperSpecs = [paperWeight, paperType].filter(v => v && v !== 'N/A').join(' ');
  const lamination = getLamination();
  const printSpecs = lamination && lamination !== 'None' ? `Lamination: ${lamination}` : undefined;

  if (!job) return null;
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    try {
      return format(new Date(dateString), 'PPP p');
    } catch {
      return 'Invalid date';
    }
  };

  const normalizedStatus = normalizeStatus(job.status);

  const getStatusColor = () => {
    if (normalizedStatus === 'on_hold') return 'bg-orange-100 text-orange-900 border-orange-300';
    if (normalizedStatus === 'active') return 'bg-green-100 text-green-900 border-green-300';
    if (job.is_ready_now) return 'bg-blue-100 text-blue-900 border-blue-300';
    if (job.is_scheduled_later) return 'bg-yellow-100 text-yellow-900 border-yellow-300';
    if (job.is_waiting_for_dependencies) return 'bg-gray-100 text-gray-900 border-gray-300';
    return 'bg-red-100 text-red-900 border-red-300';
  };

  const canStart = normalizedStatus === 'pending' && job.is_ready_now;
  const canComplete = normalizedStatus === 'active' || normalizedStatus === 'on_hold';
  const canHold = normalizedStatus === 'active';
  const canResume = normalizedStatus === 'on_hold';

  console.debug('JobDetailsModal status flags', { 
    jobId: job.id, 
    rawStatus: job.status, 
    normalizedStatus, 
    canStart, 
    canComplete, 
    canHold, 
    canResume 
  });

  const handleHoldStage = async (percentage: number, reason: string) => {
    const success = await holdStage(job.id, percentage, reason);
    if (success) {
      setShowHoldDialog(false);
      onClose();
    }
  };

  const handleResumeStage = async () => {
    const success = await resumeStage(job.id);
    if (success) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Hash className="h-5 w-5" />
            Job Details: {job.wo_no}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Job Header */}
          <Card className="border-gray-200 dark:border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {job.wo_no}
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300">{job.customer}</p>
                </div>
                <div className="text-right space-y-1">
                  <Badge 
                    className={`${getStatusColor()} border px-3 py-1 font-medium`}
                  >
                    {normalizedStatus === 'on_hold' ? 'On Hold' :
                     normalizedStatus === 'active' ? 'Active' : 
                     job.is_ready_now ? 'Ready Now' :
                     job.is_scheduled_later ? 'Scheduled' :
                     job.is_waiting_for_dependencies ? 'Waiting' : 'Blocked'}
                  </Badge>
                  {job.queue_position && (
                    <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                      Queue #{job.queue_position}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">Quantity:</span>
                  <span className="text-gray-800 dark:text-gray-200">{job.qty}</span>
                </div>
                {job.due_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">Due Date:</span>
                    <span className="text-gray-800 dark:text-gray-200">{format(new Date(job.due_date), 'MMM dd, yyyy')}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Category & Stage */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-gray-200 dark:border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-900 dark:text-gray-100">Category</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Badge 
                  variant="outline"
                  className="border-2 font-medium"
                  style={{ 
                    borderColor: job.category_color,
                    color: job.category_color,
                    backgroundColor: job.category_color + '10'
                  }}
                >
                  {job.category_name}
                </Badge>
              </CardContent>
            </Card>

            <Card className="border-gray-200 dark:border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-900 dark:text-gray-100">Current Stage</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" style={{ color: job.stage_color }} />
                  <span className="font-medium text-gray-900 dark:text-gray-100" style={{ color: job.stage_color }}>
                    {job.stage_name}
                  </span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Stage Order: {job.stage_order}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Scheduling Information */}
          {(job.scheduled_start_at || job.estimated_duration_minutes) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Scheduling
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {job.scheduled_start_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Scheduled Start:</span>
                    <span className="text-sm font-medium">
                      {formatDate(job.scheduled_start_at)}
                    </span>
                  </div>
                )}
                {job.scheduled_end_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Scheduled End:</span>
                    <span className="text-sm font-medium">
                      {formatDate(job.scheduled_end_at)}
                    </span>
                  </div>
                )}
                {job.estimated_duration_minutes && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Est. Duration:</span>
                    <span className="text-sm font-medium">
                      {Math.round(job.estimated_duration_minutes)} minutes
                    </span>
                  </div>
                )}
                {job.schedule_status && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Schedule Status:</span>
                    <Badge variant="outline" className="text-xs">
                      {job.schedule_status}
                    </Badge>
                  </div>
                )}
                </CardContent>
              </Card>
            )}

            {/* Print Specifications */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Printer className="w-4 h-4" />
                  Print Specifications
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {specsLoading ? (
                  <div className="text-sm text-gray-600">Loading specifications...</div>
                ) : specsError ? (
                  <div className="text-sm text-red-600">Failed to load specifications</div>
                ) : (printSpecs || paperSpecs || sheetSize) ? (
                  <PrintSpecsBadge
                    printSpecs={printSpecs}
                    paperSpecs={paperSpecs}
                    sheetSize={sheetSize}
                    size="normal"
                  />
                ) : (
                  <div className="text-sm text-gray-600">No specifications set</div>
                )}
              </CardContent>
            </Card>

            {/* Batch Information */}
          {job.is_batch_master && (
            <Card className="border-purple-200 bg-purple-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-purple-800 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Batch Master Job
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {job.batch_name && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-purple-700">Batch Name:</span>
                    <span className="text-sm font-medium text-purple-900">
                      {job.batch_name}
                    </span>
                  </div>
                )}
                {job.constituent_job_ids && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-purple-700">Constituent Jobs:</span>
                    <span className="text-sm font-medium text-purple-900">
                      {job.constituent_job_ids.length} jobs
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Part Assignment */}
          {job.part_assignment && job.part_assignment !== 'both' && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-700">Part Assignment</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Badge variant="outline">
                  {job.part_assignment}
                </Badge>
              </CardContent>
            </Card>
          )}

          {/* Dependencies */}
          {job.dependency_group && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-700">Dependencies</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-sm text-gray-600">
                  Dependency Group: <code className="text-xs bg-gray-100 px-1 rounded">{job.dependency_group}</code>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Job Actions */}
          <div className="flex gap-3 pt-4 border-t">
            {normalizedStatus === 'on_hold' && (
              <div className="flex-1 bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Pause className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-orange-900">Stage On Hold</p>
                    <p className="text-xs text-orange-700 mt-1">
                      {job.completion_percentage}% completed • {job.remaining_minutes} mins remaining
                    </p>
                    {job.hold_reason && (
                      <p className="text-xs text-orange-600 mt-1 italic">"{job.hold_reason}"</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {canStart && (
              <Button
                onClick={() => {
                  onStartJob?.(job.id);
                  onClose();
                }}
                disabled={stageActionsProcessing}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <QrCode className="w-4 h-4 mr-2" />
                Scan & Start Job
              </Button>
            )}

            {canHold && (
              <Button
                onClick={() => setShowHoldDialog(true)}
                disabled={stageActionsProcessing}
                variant="outline"
                className="border-orange-300 text-orange-700 hover:bg-orange-50"
              >
                <Pause className="w-4 h-4 mr-2" />
                Hold Job
              </Button>
            )}

            {canResume && (
              <Button
                onClick={handleResumeStage}
                disabled={stageActionsProcessing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Play className="w-4 h-4 mr-2" />
                Resume Job
              </Button>
            )}
            
            {canComplete && (
              <Button
                onClick={() => {
                  onCompleteJob?.(job.id);
                  onClose();
                }}
                disabled={stageActionsProcessing}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {normalizedStatus === 'on_hold' ? 'Complete Remaining' : 'Scan & Complete Job'}
              </Button>
            )}

            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>

          <StageHoldDialog
            isOpen={showHoldDialog}
            onClose={() => setShowHoldDialog(false)}
            onConfirm={handleHoldStage}
            scheduledMinutes={job.scheduled_minutes || 0}
            stageName={job.stage_name}
            isProcessing={stageActionsProcessing}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};