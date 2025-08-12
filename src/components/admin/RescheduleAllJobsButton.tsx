import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Calendar, Loader2 } from "lucide-react";
import { rescheduleAllProofCompletedJobs } from "@/utils/rescheduleAllJobs";

export const RescheduleAllJobsButton = () => {
  const [isRescheduling, setIsRescheduling] = useState(false);

  const handleReschedule = async () => {
    setIsRescheduling(true);
    try {
      await rescheduleAllProofCompletedJobs();
    } finally {
      setIsRescheduling(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          disabled={isRescheduling}
          className="gap-2"
        >
          {isRescheduling ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Calendar className="h-4 w-4" />
          )}
          Reschedule All Jobs
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reschedule All PROOF-Completed Jobs</AlertDialogTitle>
          <AlertDialogDescription>
            This will trigger the new workflow-first scheduler for all jobs that have completed their PROOF stage but lack scheduling information. This will populate the production calendar with realistic schedules.
            <br /><br />
            <strong>This action will:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Find jobs with completed PROOF stages</li>
              <li>Run the workflow-first scheduling engine</li>
              <li>Apply multi-day splits and capacity constraints</li>
              <li>Populate scheduled start/end times</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleReschedule} disabled={isRescheduling}>
            {isRescheduling ? "Rescheduling..." : "Reschedule Jobs"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};