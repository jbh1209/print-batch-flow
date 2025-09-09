import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  Calendar,
  User,
  Hash,
  AlertTriangle,
  Scan,
  PlayCircle,
  CheckCircle2,
  PauseCircle,
  Timer,
  MapPin,
  Package
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ScheduledJobStage } from "@/hooks/tracker/useScheduledJobs";
import { BarcodeActionModal } from "./BarcodeActionModal";

interface EnhancedScheduledOperatorJobCardProps {
  job: ScheduledJobStage;
  onRefresh?: () => void;
  onClick?: (job: ScheduledJobStage) => void;
  showActions?: boolean;
  compact?: boolean;
}

export const EnhancedScheduledOperatorJobCard: React.FC<EnhancedScheduledOperatorJobCardProps> = ({
  job,
  onRefresh,
  onClick,
  showActions = true,
  compact = false
}) => {
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [barcodeAction, setBarcodeAction] = useState<any>(null);

  const getStatusColor = () => {
    if (job.is_ready_now) {
      return job.status === 'active' ? 'border-l-green-500 bg-green-50' : 'border-l-blue-500 bg-blue-50';
    }
    if (job.is_scheduled_later) {
      return 'border-l-yellow-500 bg-yellow-50';
    }
    if (job.is_waiting_for_dependencies) {
      return 'border-l-gray-500 bg-gray-50';
    }
    return 'border-l-red-500 bg-red-50';
  };

  const getStatusBadge = () => {
    if (job.status === 'active') {
      return (
        <Badge variant="default" className="bg-green-600 text-white">
          <PlayCircle className="w-3 h-3 mr-1" />
          Active
        </Badge>
      );
    }
    
    if (job.is_ready_now) {
      return (
        <Badge variant="default" className="bg-blue-600 text-white">
          <Clock className="w-3 h-3 mr-1" />
          Ready Now
        </Badge>
      );
    }
    
    if (job.is_scheduled_later) {
      return (
        <Badge variant="outline" className="border-yellow-500 text-yellow-700">
          <Timer className="w-3 h-3 mr-1" />
          Scheduled
        </Badge>
      );
    }
    
    if (job.is_waiting_for_dependencies) {
      return (
        <Badge variant="outline" className="border-gray-500 text-gray-700">
          <PauseCircle className="w-3 h-3 mr-1" />
          Waiting
        </Badge>
      );
    }
    
    return (
      <Badge variant="destructive">
        <AlertTriangle className="w-3 h-3 mr-1" />
        Blocked
      </Badge>
    );
  };

  const handleStartJob = async () => {
    setBarcodeAction({
      type: 'start',
      jobId: job.job_id,
      jobWo: job.wo_no,
      stageId: job.id,
      stageName: job.stage_name || 'Unknown Stage',
      expectedBarcodeData: `WO${job.wo_no}J${job.job_id.substring(0, 8).toUpperCase()}`,
      isBatchMaster: job.is_batch_master,
      batchName: job.batch_name,
      constituentJobIds: job.constituent_job_ids
    });
    setShowBarcodeModal(true);
  };

  const handleCompleteJob = async () => {
    setBarcodeAction({
      type: 'complete',
      jobId: job.job_id,
      jobWo: job.wo_no,
      stageId: job.id,
      stageName: job.stage_name || 'Unknown Stage',
      expectedBarcodeData: `WO${job.wo_no}J${job.job_id.substring(0, 8).toUpperCase()}`,
      isBatchMaster: job.is_batch_master,
      batchName: job.batch_name,
      constituentJobIds: job.constituent_job_ids
    });
    setShowBarcodeModal(true);
  };

  const formatScheduledTime = (dateString?: string) => {
    if (!dateString) return null;
    try {
      return format(new Date(dateString), 'HH:mm');
    } catch {
      return null;
    }
  };

  const formatScheduledDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      const today = new Date();
      if (date.toDateString() === today.toDateString()) {
        return 'Today';
      }
      return format(date, 'MMM dd');
    } catch {
      return null;
    }
  };

  const canStart = job.status === 'pending' && job.is_ready_now;
  const canComplete = job.status === 'active';

  return (
    <>
      <Card 
        className={cn(
          "border-l-4 transition-all duration-200 hover:shadow-lg cursor-pointer transform hover:scale-[1.02]",
          getStatusColor(),
          compact ? "p-2" : "p-4",
          job.is_waiting_for_dependencies && "opacity-70",
          onClick && "hover:bg-white"
        )}
        onClick={() => onClick?.(job)}
      >
        <CardContent className={cn("p-0", compact && "space-y-2")}>
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 text-sm">
                  {job.wo_no}
                </h3>
                <Badge 
                  variant="outline" 
                  className="text-xs"
                  style={{ 
                    borderColor: job.category_color,
                    color: job.category_color 
                  }}
                >
                  {job.category_name}
                </Badge>
                {job.is_batch_master && (
                  <Badge variant="outline" className="text-xs bg-purple-50 border-purple-200 text-purple-700">
                    Batch
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-600 flex items-center gap-1">
                <User className="w-3 h-3" />
                {job.customer}
              </p>
              <p className="text-sm font-medium" style={{ color: job.stage_color }}>
                <MapPin className="w-3 h-3 inline mr-1" />
                {job.stage_name}
              </p>
            </div>
            
            <div className="flex flex-col items-end gap-1">
              {getStatusBadge()}
              {job.queue_position && (
                <Badge variant="outline" className="text-xs">
                  Queue #{job.queue_position}
                </Badge>
              )}
            </div>
          </div>

          {/* Job Details */}
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
            <div className="flex items-center gap-1">
              <Package className="w-3 h-3" />
              Qty: {job.qty}
            </div>
            {job.due_date && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Due: {format(new Date(job.due_date), 'MMM dd')}
              </div>
            )}
          </div>

          {/* Scheduling Information */}
          {(job.scheduled_start_at || job.estimated_duration_minutes) && (
            <div className="bg-white/50 rounded p-2 text-xs space-y-1">
              {job.scheduled_start_at && (
                <div className="flex items-center gap-1 text-gray-700">
                  <Clock className="w-3 h-3" />
                  <span className="font-medium">
                    {formatScheduledDate(job.scheduled_start_at)} at {formatScheduledTime(job.scheduled_start_at)}
                  </span>
                  {job.scheduled_end_at && (
                    <span className="text-gray-500">
                      - {formatScheduledTime(job.scheduled_end_at)}
                    </span>
                  )}
                </div>
              )}
              {job.estimated_duration_minutes && (
                <div className="flex items-center gap-1 text-gray-600">
                  <Timer className="w-3 h-3" />
                  Est. {Math.round(job.estimated_duration_minutes)} min
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {showActions && (
            <div className="flex gap-2 pt-2">
              {canStart && (
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartJob();
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Scan className="w-4 h-4 mr-1" />
                  Scan & Start
                </Button>
              )}
              
              {canComplete && (
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCompleteJob();
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <Scan className="w-4 w-4 mr-1" />
                  Scan & Complete
                </Button>
              )}

              {!job.is_ready_now && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled
                  className="flex-1 opacity-50"
                >
                  {job.is_scheduled_later ? 'Scheduled Later' : 'Waiting...'}
                </Button>
              )}
            </div>
          )}

          {/* Part Assignment Indicator */}
          {job.part_assignment && job.part_assignment !== 'both' && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <Badge variant="outline" className="text-xs">
                Part: {job.part_assignment}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Barcode Action Modal */}
      <BarcodeActionModal
        isOpen={showBarcodeModal}
        onClose={() => {
          setShowBarcodeModal(false);
          setBarcodeAction(null);
        }}
        action={barcodeAction}
        onSuccess={() => {
          onRefresh?.();
        }}
      />
    </>
  );
};