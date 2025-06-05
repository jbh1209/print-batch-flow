
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  AlertTriangle, 
  Pause, 
  Play, 
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { HoldReasonSelector, HOLD_REASONS } from "./hold/HoldReasonSelector";

interface JobHoldManagerProps {
  job: AccessibleJob;
  onHoldJob?: (jobId: string, reason: string, notes?: string) => Promise<boolean>;
  onReleaseJob?: (jobId: string, notes?: string) => Promise<boolean>;
  className?: string;
}

export const JobHoldManager: React.FC<JobHoldManagerProps> = ({
  job,
  onHoldJob,
  onReleaseJob,
  className
}) => {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [holdNotes, setHoldNotes] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Mock job hold status - in real implementation, this would come from job data
  const isJobOnHold = job.current_stage_status === 'hold' || false;
  const currentHoldReason = "material_shortage"; // Mock data
  const holdStartTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // Mock: 2 hours ago

  const getReasonLabel = (reasonId: string): string => {
    const reason = HOLD_REASONS.find(r => r.id === reasonId);
    return reason ? reason.label : reasonId.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleHoldJob = async () => {
    if (!selectedReason || !onHoldJob) return;

    setIsProcessing(true);
    try {
      const success = await onHoldJob(job.job_id, selectedReason, holdNotes);
      if (success) {
        setSelectedReason("");
        setHoldNotes("");
      }
    } catch (error) {
      console.error("Failed to hold job:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReleaseJob = async () => {
    if (!onReleaseJob) return;

    setIsProcessing(true);
    try {
      const success = await onReleaseJob(job.job_id, releaseNotes);
      if (success) {
        setReleaseNotes("");
      }
    } catch (error) {
      console.error("Failed to release job:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isJobOnHold ? (
            <>
              <Pause className="h-5 w-5 text-orange-500" />
              Job On Hold
            </>
          ) : (
            <>
              <AlertTriangle className="h-5 w-5" />
              Hold Management
            </>
          )}
          <Badge variant="outline" className="ml-auto">
            {job.wo_no}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isJobOnHold ? (
          /* Job is currently on hold - show release options */
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Pause className="h-4 w-4 text-orange-500" />
                  <span className="font-medium text-orange-800">Currently On Hold</span>
                </div>
                <p className="text-sm text-orange-700">
                  Reason: {getReasonLabel(currentHoldReason)}
                </p>
                <div className="flex items-center gap-2 text-xs text-orange-600">
                  <Clock className="h-3 w-3" />
                  <span>Since: {holdStartTime.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="release-notes">Release Notes (Optional)</Label>
              <Textarea
                id="release-notes"
                placeholder="Add notes about resolving the hold..."
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            <Button 
              onClick={handleReleaseJob}
              disabled={isProcessing}
              className="w-full flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              <Play className="h-4 w-4" />
              {isProcessing ? 'Releasing...' : 'Release Job'}
            </Button>
          </div>
        ) : (
          /* Job is not on hold - show hold options */
          <div className="space-y-6">
            <HoldReasonSelector
              selectedReason={selectedReason}
              onReasonChange={setSelectedReason}
            />

            <div className="space-y-3">
              <Label htmlFor="hold-notes">
                Additional Notes 
                {selectedReason === 'other' && <span className="text-red-500">*</span>}
              </Label>
              <Textarea
                id="hold-notes"
                placeholder={
                  selectedReason === 'other' 
                    ? "Please specify the reason for holding this job..."
                    : "Add any additional details about the hold..."
                }
                value={holdNotes}
                onChange={(e) => setHoldNotes(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            <Button 
              onClick={handleHoldJob}
              disabled={!selectedReason || (selectedReason === 'other' && !holdNotes.trim()) || isProcessing}
              variant="destructive"
              className="w-full flex items-center gap-2"
            >
              <Pause className="h-4 w-4" />
              {isProcessing ? 'Holding...' : 'Hold Job'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
