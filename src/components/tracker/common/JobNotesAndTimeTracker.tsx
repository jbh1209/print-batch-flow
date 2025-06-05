
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { TimeTracker, TimeEntry } from "./time-tracking/TimeTracker";
import { NotesEditor } from "./notes/NotesEditor";

interface JobNotesAndTimeTrackerProps {
  job: AccessibleJob;
  onNotesUpdate?: (jobId: string, notes: string) => Promise<void>;
  onTimeUpdate?: (jobId: string, timeData: TimeEntry) => Promise<void>;
  className?: string;
}

export const JobNotesAndTimeTracker: React.FC<JobNotesAndTimeTrackerProps> = ({
  job,
  onNotesUpdate,
  onTimeUpdate,
  className
}) => {
  const handleNotesUpdate = async (notes: string) => {
    if (onNotesUpdate) {
      await onNotesUpdate(job.job_id, notes);
    }
  };

  const handleTimeUpdate = async (timeData: TimeEntry) => {
    if (onTimeUpdate) {
      await onTimeUpdate(job.job_id, timeData);
    }
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Notes & Time Tracking
          <Badge variant="outline" className="ml-auto">
            {job.wo_no}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <TimeTracker
          onTimeUpdate={handleTimeUpdate}
          jobNumber={job.wo_no || ''}
        />

        <Separator />

        <NotesEditor
          onNotesUpdate={handleNotesUpdate}
          jobNumber={job.wo_no || ''}
        />
      </CardContent>
    </Card>
  );
};

export type { TimeEntry };
