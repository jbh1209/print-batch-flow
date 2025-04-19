
import { useState } from "react";
import { Job } from "@/components/business-cards/JobsTable";

export const useJobSelection = () => {
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);

  const handleSelectJob = (jobId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedJobs([...selectedJobs, jobId]);
    } else {
      setSelectedJobs(selectedJobs.filter(id => id !== jobId));
    }
  };

  const handleSelectAllJobs = (isSelected: boolean) => {
    setSelectedJobs([]);
  };

  const getSelectedJobObjects = (jobs: Job[]) => {
    return jobs.filter(job => selectedJobs.includes(job.id));
  };

  return {
    selectedJobs,
    handleSelectJob,
    handleSelectAllJobs,
    getSelectedJobObjects,
  };
};
