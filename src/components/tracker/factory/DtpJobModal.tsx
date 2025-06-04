
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
import { Textarea } from "@/components/ui/textarea";
import { 
  Play, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  User,
  Calendar,
  Package,
  FileText,
  MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { toast } from "sonner";

interface DtpJobModalProps {
  job: AccessibleJob;
  isOpen: boolean;
  onClose: () => void;
  onStart: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete: (jobId: string, stageId: string) => Promise<boolean>;
}

export const DtpJobModal: React.FC<DtpJobModalProps> = ({
  job,
  isOpen,
  onClose,
  onStart,
  onComplete
}) => {
  const [isActionInProgress, setIsActionInProgress] = useState(false);
  const [notes, setNotes] = useState("");

  const isOverdue = job.due_date && new Date(job.due_date) < new Date();
  const isDueSoon = job.due_date && !isOverdue && 
    new Date(job.due_date) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const getStatusInfo = () => {
    if (job.current_stage_status === 'active') {
      return {
        color: "text-green-600",
        bg: "bg-green-50",
        border: "border-green-200",
        text: "In Progress",
        icon: <Clock className="h-4 w-4" />
      };
    }
    return {
      color: "text-orange-600",
      bg: "bg-orange-50", 
      border: "border-orange-200",
      text: "Pending",
      icon: <AlertTriangle className="h-4 w-4" />
    };
  };

  const handleAction = async (action: () => Promise<boolean>) => {
    setIsActionInProgress(true);
    try {
      const success = await action();
      if (success) {
        onClose();
      }
    } finally {
      setIsActionInProgress(false);
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Job Details: {job.wo_no}</span>
            <Badge 
              className={cn(statusInfo.color, statusInfo.bg, statusInfo.border)}
              variant="outline"
            >
              {statusInfo.icon}
              <span className="ml-1">{statusInfo.text}</span>
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Job Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Job Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Work Order</label>
                  <p className="text-lg font-semibold">{job.wo_no}</p>
                </div>
                {job.customer && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Customer</label>
                    <p className="text-lg">{job.customer}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {job.reference && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Reference</label>
                    <p>{job.reference}</p>
                  </div>
                )}
                {job.category && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Category</label>
                    <p>{job.category}</p>
                  </div>
                )}
              </div>

              {job.due_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Due Date:</span>
                  <span className={cn(
                    "font-medium",
                    isOverdue ? "text-red-600" : 
                    isDueSoon ? "text-orange-600" : 
                    "text-gray-900"
                  )}>
                    {new Date(job.due_date).toLocaleDateString()}
                  </span>
                  {isOverdue && (
                    <Badge variant="destructive" className="text-xs">
                      Overdue
                    </Badge>
                  )}
                  {isDueSoon && !isOverdue && (
                    <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">
                      Due Soon
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current Stage */}
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

          {/* Work Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Work Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-gray-700">
                  Complete the {job.current_stage_name?.toLowerCase()} stage for this job. 
                  Ensure all quality checks are performed according to standard procedures.
                </p>
                
                {job.current_stage_status === 'pending' && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-sm text-blue-800">
                      <strong>Next step:</strong> Click "Start Job" to begin working on this stage.
                    </p>
                  </div>
                )}

                {job.current_stage_status === 'active' && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded">
                    <p className="text-sm text-green-800">
                      <strong>In progress:</strong> Complete your work and click "Complete Job" when finished.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notes Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add notes about your work on this job..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[100px]"
              />
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        {job.user_can_work && job.current_stage_id && (
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            
            {job.current_stage_status === 'pending' && (
              <Button 
                onClick={() => handleAction(() => onStart(job.job_id, job.current_stage_id!))}
                disabled={isActionInProgress}
                className="bg-green-600 hover:bg-green-700"
              >
                <Play className="h-4 w-4 mr-2" />
                {isActionInProgress ? "Starting..." : "Start Job"}
              </Button>
            )}
            
            {job.current_stage_status === 'active' && (
              <Button 
                onClick={() => handleAction(() => onComplete(job.job_id, job.current_stage_id!))}
                disabled={isActionInProgress}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {isActionInProgress ? "Completing..." : "Complete Job"}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
