import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRushJobHandler } from "@/hooks/tracker/useRushJobHandler";
import { useAuth } from "@/hooks/useAuth";
import { 
  AlertTriangle, 
  Clock, 
  Zap, 
  AlertCircle 
} from "lucide-react";
import { cn } from "@/lib/utils";

const urgencyLevels = [
  {
    value: 'high' as const,
    label: 'High Priority',
    description: 'Move ahead in queue within 2 hours',
    icon: Clock,
    color: 'text-orange-600 bg-orange-100',
  },
  {
    value: 'critical' as const,
    label: 'Critical',
    description: 'Start within 30 minutes',
    icon: AlertTriangle,
    color: 'text-red-600 bg-red-100',
  },
  {
    value: 'emergency' as const,
    label: 'Emergency',
    description: 'Stop current work and start immediately',
    icon: Zap,
    color: 'text-red-800 bg-red-200',
  },
];

export const RushJobModal: React.FC = () => {
  const { user } = useAuth();
  const { 
    showRushModal, 
    selectedJob, 
    closeRushModal, 
    submitRushRequest, 
    isSubmitting 
  } = useRushJobHandler();
  
  const [reason, setReason] = useState("");
  const [urgencyLevel, setUrgencyLevel] = useState<'high' | 'critical' | 'emergency'>('high');

  const handleSubmit = () => {
    if (!selectedJob || !user || !reason.trim()) return;

    const request = {
      jobId: selectedJob.job_id,
      woNo: selectedJob.wo_no,
      customer: selectedJob.customer,
      currentStage: selectedJob.current_stage_name,
      requestedBy: user.id,
      reason: reason.trim(),
      urgencyLevel,
    };

    submitRushRequest.mutate(request, {
      onSuccess: () => {
        setReason("");
        setUrgencyLevel('high');
      }
    });
  };

  const handleClose = () => {
    setReason("");
    setUrgencyLevel('high');
    closeRushModal();
  };

  if (!selectedJob) return null;

  return (
    <Dialog open={showRushModal} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Submit Rush Job Request
          </DialogTitle>
          <DialogDescription>
            Request priority scheduling for this job. Supervisor approval may be required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Job Details */}
          <div className="p-4 bg-gray-50 rounded-lg border">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">Work Order</Label>
                <p className="font-semibold">{selectedJob.wo_no}</p>
              </div>
              {selectedJob.customer && (
                <div>
                  <Label className="text-sm font-medium text-gray-600">Customer</Label>
                  <p className="font-semibold">{selectedJob.customer}</p>
                </div>
              )}
              <div>
                <Label className="text-sm font-medium text-gray-600">Current Stage</Label>
                <p className="font-semibold">{selectedJob.current_stage_name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Status</Label>
                <Badge variant={selectedJob.current_stage_status === 'active' ? 'default' : 'secondary'}>
                  {selectedJob.current_stage_status}
                </Badge>
              </div>
            </div>
          </div>

          {/* Urgency Level */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Urgency Level</Label>
            <RadioGroup value={urgencyLevel} onValueChange={(value: any) => setUrgencyLevel(value)}>
              {urgencyLevels.map((level) => {
                const IconComponent = level.icon;
                return (
                  <div key={level.value} className="flex items-center space-x-3">
                    <RadioGroupItem value={level.value} id={level.value} />
                    <Label 
                      htmlFor={level.value} 
                      className="flex items-center gap-3 cursor-pointer flex-1 p-3 rounded-lg border hover:bg-gray-50"
                    >
                      <div className={cn("p-2 rounded-full", level.color)}>
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{level.label}</p>
                        <p className="text-sm text-gray-600">{level.description}</p>
                      </div>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-semibold">
              Reason for Rush Request *
            </Label>
            <Textarea
              id="reason"
              placeholder="Explain why this job needs to be prioritized (customer complaint, deadline, etc.)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[100px]"
              maxLength={500}
            />
            <p className="text-xs text-gray-500">{reason.length}/500 characters</p>
          </div>

          {/* Warning */}
          {urgencyLevel === 'emergency' && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">
                <strong>Emergency Priority:</strong> This will interrupt current work and may 
                require immediate supervisor approval. Use only for genuine emergencies.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !reason.trim()}
            className={cn(
              urgencyLevel === 'emergency' ? 'bg-red-600 hover:bg-red-700' :
              urgencyLevel === 'critical' ? 'bg-orange-600 hover:bg-orange-700' :
              'bg-yellow-600 hover:bg-yellow-700'
            )}
          >
            {isSubmitting ? "Submitting..." : "Submit Rush Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};