
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { JobOverviewCard } from "./JobOverviewCard";
import { CurrentStageCard } from "./CurrentStageCard";
import { WorkInstructionsCard } from "./WorkInstructionsCard";
import { JobNotesCard } from "./JobNotesCard";
import { JobModalActions } from "./JobModalActions";

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
  const [notes, setNotes] = useState("");

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
          <JobOverviewCard job={job} />
          <CurrentStageCard job={job} statusInfo={statusInfo} />
          <WorkInstructionsCard job={job} />
          <JobNotesCard notes={notes} onNotesChange={setNotes} />
        </div>

        <JobModalActions
          job={job}
          onClose={onClose}
          onStart={onStart}
          onComplete={onComplete}
        />
      </DialogContent>
    </Dialog>
  );
};
