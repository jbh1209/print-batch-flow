
import { formatDistanceToNow } from "date-fns";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Job } from "../../JobsTable";

interface UpcomingDueJobsSectionProps {
  upcomingDueJobs: Job[];
  onSelectJob: (jobId: string, isSelected: boolean) => void;
}

const UpcomingDueJobsSection = ({
  upcomingDueJobs,
  onSelectJob
}: UpcomingDueJobsSectionProps) => {
  if (upcomingDueJobs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-md bg-amber-50 p-3 text-sm border border-amber-200">
      <div className="font-medium text-amber-800 flex items-center gap-1">
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm sm:text-base">Jobs With Upcoming Due Dates</span>
      </div>
      <p className="text-amber-700 text-xs mb-2">Consider adding these jobs to your batch:</p>
      <div className="max-h-32 sm:max-h-40 overflow-auto space-y-1">
        {upcomingDueJobs.slice(0, 5).map(job => (
          <div key={job.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-xs py-1 border-t border-amber-200/50 first:border-t-0">
            <div className="flex flex-col min-w-0">
              <span className="font-medium truncate">{job.name}</span>
              <span className="text-amber-700 text-xs">
                Due: {formatDistanceToNow(new Date(job.due_date), { addSuffix: true })}
              </span>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              className="h-6 sm:h-7 text-xs px-2 flex-shrink-0 self-start sm:self-center"
              onClick={() => onSelectJob(job.id, true)}
            >
              Add
            </Button>
          </div>
        ))}
        {upcomingDueJobs.length > 5 && (
          <div className="text-center text-xs text-amber-700 mt-1">
            +{upcomingDueJobs.length - 5} more jobs
          </div>
        )}
      </div>
    </div>
  );
};

export default UpcomingDueJobsSection;
