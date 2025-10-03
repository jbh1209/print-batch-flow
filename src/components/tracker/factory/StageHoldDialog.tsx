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
import { Pause } from "lucide-react";

interface StageHoldDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (percentage: number, reason: string) => void;
  scheduledMinutes: number;
  stageName: string;
  isProcessing: boolean;
}

const StageHoldDialog: React.FC<StageHoldDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  scheduledMinutes,
  stageName,
  isProcessing,
}) => {
  const [selectedPercentage, setSelectedPercentage] = useState<number | null>(null);
  const [holdReason, setHoldReason] = useState("");

  const handleConfirm = () => {
    if (selectedPercentage !== null && holdReason.trim()) {
      onConfirm(selectedPercentage, holdReason);
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedPercentage(null);
    setHoldReason("");
    onClose();
  };

  const getRemainingMinutes = (percentage: number) => {
    return Math.round(scheduledMinutes * (1 - percentage / 100));
  };

  const percentageOptions = [25, 50, 75];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pause className="h-5 w-5 text-orange-500" />
            Hold Stage - {stageName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="text-sm font-medium mb-3 block">
              How much of the stage has been completed?
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {percentageOptions.map((percentage) => (
                <Button
                  key={percentage}
                  type="button"
                  variant={selectedPercentage === percentage ? "default" : "outline"}
                  onClick={() => setSelectedPercentage(percentage)}
                  className="h-20 flex flex-col items-center justify-center"
                >
                  <span className="text-2xl font-bold">{percentage}%</span>
                  <span className="text-xs mt-1">
                    {getRemainingMinutes(percentage)} mins left
                  </span>
                </Button>
              ))}
            </div>
          </div>

          {selectedPercentage !== null && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-sm text-blue-800">
                <strong>Remaining time:</strong> {getRemainingMinutes(selectedPercentage)} minutes
                will be rescheduled
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="holdReason" className="text-sm font-medium mb-2 block">
              Reason for hold (required)
            </Label>
            <Textarea
              id="holdReason"
              placeholder="Explain why the stage couldn't be completed (e.g., technical issues, material shortage, etc.)"
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={
              selectedPercentage === null ||
              !holdReason.trim() ||
              isProcessing
            }
          >
            {isProcessing ? "Holding..." : "Confirm Hold"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StageHoldDialog;
