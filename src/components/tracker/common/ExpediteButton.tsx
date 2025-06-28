
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, X } from "lucide-react";
import { ExpediteJobDialog } from "./ExpediteJobDialog";
import { useJobExpediting } from "@/hooks/tracker/useJobExpediting";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ExpediteButtonProps {
  job: AccessibleJob & { 
    is_expedited?: boolean;
    expedite_reason?: string;
    expedited_at?: string;
  };
  onJobUpdated: () => void;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "ghost";
  showLabel?: boolean;
  compact?: boolean;
}

export const ExpediteButton: React.FC<ExpediteButtonProps> = ({
  job,
  onJobUpdated,
  size = "sm",
  variant = "outline",
  showLabel = true,
  compact = false
}) => {
  const [showExpediteDialog, setShowExpediteDialog] = useState(false);
  const { removeExpediteStatus, isRemovingExpedite } = useJobExpediting();

  const handleRemoveExpedite = async () => {
    const success = await removeExpediteStatus(job.job_id);
    if (success) {
      onJobUpdated();
    }
  };

  // Show expedited status if job is expedited
  if (job.is_expedited) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <Badge className="bg-red-100 text-red-800 border-red-300 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {compact ? "RUSH" : "EXPEDITED"}
              </Badge>
              {!compact && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleRemoveExpedite}
                  disabled={isRemovingExpedite}
                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <p className="font-medium">Expedited Job</p>
              {job.expedite_reason && (
                <p className="text-gray-600 mt-1">{job.expedite_reason}</p>
              )}
              {job.expedited_at && (
                <p className="text-xs text-gray-500 mt-1">
                  Expedited: {new Date(job.expedited_at).toLocaleString()}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Show expedite button if job is not expedited
  return (
    <>
      <Button
        size={size}
        variant={variant}
        onClick={() => setShowExpediteDialog(true)}
        className="flex items-center gap-2 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
      >
        <Zap className={compact ? "h-3 w-3" : "h-4 w-4"} />
        {showLabel && !compact && "Expedite"}
      </Button>

      <ExpediteJobDialog
        isOpen={showExpediteDialog}
        onClose={() => setShowExpediteDialog(false)}
        jobId={job.job_id}
        jobWoNo={job.wo_no}
        onExpedited={onJobUpdated}
      />
    </>
  );
};
