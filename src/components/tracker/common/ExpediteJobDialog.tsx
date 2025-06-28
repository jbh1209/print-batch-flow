
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Zap } from "lucide-react";
import { useJobExpediting } from "@/hooks/tracker/useJobExpediting";

interface ExpediteJobDialogProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobWoNo: string;
  onExpedited: () => void;
}

export const ExpediteJobDialog: React.FC<ExpediteJobDialogProps> = ({
  isOpen,
  onClose,
  jobId,
  jobWoNo,
  onExpedited
}) => {
  const [reason, setReason] = useState("");
  const { expediteJob, isExpediting } = useJobExpediting();

  const handleExpedite = async () => {
    if (!reason.trim()) {
      return;
    }

    const success = await expediteJob(jobId, reason.trim());
    if (success) {
      onExpedited();
      onClose();
      setReason("");
    }
  };

  const handleClose = () => {
    onClose();
    setReason("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-red-500" />
            Expedite Job {jobWoNo}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-red-800 mb-1">
                  Factory-Wide Priority
                </p>
                <p className="text-red-700">
                  This job will jump to the top of the queue in <strong>every stage</strong> throughout the factory workflow.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expedite-reason">Reason for expediting *</Label>
            <Textarea
              id="expedite-reason"
              placeholder="e.g., Rush order from key client, emergency replacement, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleExpedite}
            disabled={!reason.trim() || isExpediting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isExpediting ? (
              <>Processing...</>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Expedite Job
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
