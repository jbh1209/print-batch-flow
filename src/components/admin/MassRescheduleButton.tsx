import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Calendar, Clock } from "lucide-react";
import { useState } from "react";
import { massRescheduleAllJobs } from "@/utils/massRescheduleJobs";

export function MassRescheduleButton() {
  const [isRescheduling, setIsRescheduling] = useState(false);

  const handleMassReschedule = async () => {
    setIsRescheduling(true);
    try {
      const result = await massRescheduleAllJobs();
      console.log('Mass reschedule result:', result);
    } finally {
      setIsRescheduling(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2"
          disabled={isRescheduling}
        >
          <Calendar className="h-4 w-4" />
          {isRescheduling ? 'Rescheduling...' : 'Mass Reschedule All Jobs'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Mass Reschedule All Jobs
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will reschedule ALL production jobs using the fixed scheduler engine. 
            This process will:
            <br />• Clear existing schedules
            <br />• Apply the workflow-first scheduling algorithm
            <br />• Update the production calendar
            <br />• Take approximately 2-5 minutes to complete
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRescheduling}>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleMassReschedule}
            disabled={isRescheduling}
            className="bg-primary hover:bg-primary/90"
          >
            {isRescheduling ? 'Rescheduling...' : 'Start Mass Reschedule'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}