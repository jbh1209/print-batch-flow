
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { JobsSelectionHeader } from "./JobsSelectionHeader";
import { JobsSelectionTable } from "./JobsSelectionTable";

interface JobsSelectionPanelProps {
  availableJobs: FlyerJob[];
  selectedJobIds: string[];
  handleSelectJob: (jobId: string, isSelected: boolean) => void;
  handleSelectAllJobs: (isSelected: boolean) => void;
}

export const JobsSelectionPanel = ({
  availableJobs,
  selectedJobIds,
  handleSelectJob,
  handleSelectAllJobs,
}: JobsSelectionPanelProps) => {
  return (
    <div className="lg:col-span-2 border rounded-md">
      <JobsSelectionHeader 
        selectedJobsCount={selectedJobIds.length} 
        totalJobsCount={availableJobs.length} 
      />
      <JobsSelectionTable
        availableJobs={availableJobs}
        selectedJobIds={selectedJobIds}
        handleSelectJob={handleSelectJob}
        handleSelectAllJobs={handleSelectAllJobs}
      />
    </div>
  );
};
