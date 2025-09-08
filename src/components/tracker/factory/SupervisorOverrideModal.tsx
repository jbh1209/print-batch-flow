import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  AlertTriangle, 
  Shield, 
  Clock,
  Users,
  Calendar,
  Settings
} from "lucide-react";
import { ScheduledJobStage } from "@/hooks/tracker/useScheduledJobs";

interface SupervisorOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: ScheduledJobStage | null;
  onApprove: (override: {
    supervisorId: string;
    reason: string;
    overrideType: 'queue_order' | 'dependency' | 'schedule' | 'concurrent';
  }) => void;
  isProcessing?: boolean;
}

export const SupervisorOverrideModal: React.FC<SupervisorOverrideModalProps> = ({
  isOpen,
  onClose,
  job,
  onApprove,
  isProcessing = false
}) => {
  const [reason, setReason] = useState("");
  const [overrideType, setOverrideType] = useState<'queue_order' | 'dependency' | 'schedule' | 'concurrent'>('queue_order');

  const handleApprove = () => {
    if (!reason.trim()) {
      return;
    }

    onApprove({
      supervisorId: 'current-user', // This would be the actual supervisor ID
      reason: reason.trim(),
      overrideType
    });

    // Reset form
    setReason("");
    setOverrideType('queue_order');
  };

  const handleClose = () => {
    setReason("");
    setOverrideType('queue_order');
    onClose();
  };

  if (!job) return null;

  const getOverrideTypeIcon = (type: string) => {
    switch (type) {
      case 'queue_order': return <Users className="h-4 w-4" />;
      case 'dependency': return <AlertTriangle className="h-4 w-4" />;
      case 'schedule': return <Clock className="h-4 w-4" />;
      case 'concurrent': return <Settings className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  const getOverrideTypeDescription = (type: string) => {
    switch (type) {
      case 'queue_order': 
        return "Allow starting this job out of queue order";
      case 'dependency': 
        return "Override dependency requirements and start immediately";
      case 'schedule': 
        return "Override scheduled timing and start now";
      case 'concurrent': 
        return "Allow concurrent processing in this department";
      default: 
        return "General supervisor override";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-600" />
            Supervisor Override Required
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Job Information */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">{job.wo_no}</h4>
              <Badge 
                variant="outline"
                style={{ 
                  borderColor: job.category_color,
                  color: job.category_color 
                }}
              >
                {job.category_name}
              </Badge>
            </div>
            <p className="text-sm text-gray-600">{job.customer}</p>
            <p className="text-sm font-medium" style={{ color: job.stage_color }}>
              {job.stage_name}
            </p>
            
            {/* Current Status */}
            <div className="flex gap-2 mt-2">
              <Badge 
                variant={job.is_ready_now ? "default" : "outline"}
                className={job.is_ready_now ? "bg-green-600 text-white" : ""}
              >
                {job.status === 'active' ? 'Active' :
                 job.is_ready_now ? 'Ready Now' :
                 job.is_scheduled_later ? 'Scheduled Later' :
                 'Waiting'}
              </Badge>
              {job.queue_position && (
                <Badge variant="outline">Queue #{job.queue_position}</Badge>
              )}
            </div>
          </div>

          {/* Override Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Override Type</Label>
            <RadioGroup value={overrideType} onValueChange={(value: any) => setOverrideType(value)}>
              {[
                { value: 'queue_order', label: 'Queue Order Override' },
                { value: 'dependency', label: 'Dependency Override' },
                { value: 'schedule', label: 'Schedule Override' },
                { value: 'concurrent', label: 'Concurrent Processing' }
              ].map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label 
                    htmlFor={option.value} 
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    {getOverrideTypeIcon(option.value)}
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-gray-500">
                        {getOverrideTypeDescription(option.value)}
                      </div>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-medium">
              Reason for Override *
            </Label>
            <Textarea
              id="reason"
              placeholder="Explain why this override is necessary (e.g., urgent customer request, equipment availability, etc.)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-amber-800">Supervisor Authorization</div>
                <div className="text-amber-700">
                  This override will be logged for audit purposes. Ensure you have proper 
                  authorization before proceeding.
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleApprove}
            disabled={!reason.trim() || isProcessing}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isProcessing ? "Applying..." : "Approve Override"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};