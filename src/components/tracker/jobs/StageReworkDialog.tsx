
import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RotateCcw } from "lucide-react";

interface StageReworkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentStage: {
    id: string;
    name: string;
    color: string;
  };
  targetStage: {
    id: string;
    name: string;
    color: string;
  };
  jobNumber: string;
  onConfirm: (reason: string) => void;
  isLoading?: boolean;
}

export const StageReworkDialog: React.FC<StageReworkDialogProps> = ({
  isOpen,
  onClose,
  currentStage,
  targetStage,
  jobNumber,
  onConfirm,
  isLoading = false
}) => {
  const [reworkReason, setReworkReason] = useState("");

  const handleConfirm = () => {
    onConfirm(reworkReason.trim());
    setReworkReason("");
  };

  const handleClose = () => {
    setReworkReason("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-orange-600" />
            Send Back for Rework
          </DialogTitle>
          <DialogDescription>
            Send job {jobNumber} back from {currentStage.name} to {targetStage.name} for changes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stage Flow Visual */}
          <div className="flex items-center justify-center gap-2 py-4 bg-gray-50 rounded-lg">
            <Badge 
              variant="outline"
              style={{ 
                backgroundColor: `${currentStage.color}20`, 
                color: currentStage.color, 
                borderColor: `${currentStage.color}40` 
              }}
            >
              {currentStage.name}
            </Badge>
            <ArrowLeft className="h-4 w-4 text-orange-600" />
            <Badge 
              variant="outline"
              style={{ 
                backgroundColor: `${targetStage.color}20`, 
                color: targetStage.color, 
                borderColor: `${targetStage.color}40` 
              }}
            >
              {targetStage.name}
            </Badge>
          </div>

          {/* Reason Input */}
          <div className="space-y-2">
            <Label htmlFor="rework-reason">
              Reason for Rework <span className="text-gray-500">(optional)</span>
            </Label>
            <Textarea
              id="rework-reason"
              placeholder="e.g., Client requested color changes, typo correction needed..."
              value={reworkReason}
              onChange={(e) => setReworkReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isLoading ? "Sending Back..." : "Send Back for Rework"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
