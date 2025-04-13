
import { useState, useEffect } from "react";
import { Job } from "../JobsTable";
import { 
  calculateOptimalDistribution, 
  shouldRecommendBatch,
  BatchOptimization,
  MIN_RECOMMENDED_JOBS
} from "@/utils/batchOptimizationHelpers";

export const useBatchHelpers = (selectedJobs: Job[], allAvailableJobs: Job[]) => {
  const [optimization, setOptimization] = useState<BatchOptimization | null>(null);
  
  // Calculate optimization whenever selected jobs change
  useEffect(() => {
    if (selectedJobs.length > 0) {
      const optimizedBatch = calculateOptimalDistribution(selectedJobs);
      setOptimization(optimizedBatch);
    } else {
      setOptimization(null);
    }
  }, [selectedJobs]);
  
  // Determine if selected jobs are compatible for batching
  const areJobsCompatible = () => {
    if (selectedJobs.length <= 1) {
      return true; // Single job or no jobs is always compatible
    }
    
    // All jobs should have the same lamination type
    const firstLamination = selectedJobs[0].lamination_type;
    return selectedJobs.every(job => job.lamination_type === firstLamination);
  };
  
  // Check if we should recommend creating a batch
  const shouldRecommend = shouldRecommendBatch(allAvailableJobs.filter(j => j.status === 'queued'));
  
  // Find jobs with upcoming due dates
  const getUpcomingDueJobs = () => {
    const now = new Date();
    return allAvailableJobs
      .filter(job => job.status === 'queued' && !selectedJobs.find(j => j.id === job.id))
      .filter(job => {
        const dueDate = new Date(job.due_date);
        const hoursDifference = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        return hoursDifference <= 48; // Jobs due within 48 hours
      });
  };
  
  const upcomingDueJobs = getUpcomingDueJobs();
  const isCompatible = areJobsCompatible();
  const showBatchRecommendation = shouldRecommend && selectedJobs.length < MIN_RECOMMENDED_JOBS;
  
  return {
    optimization,
    isCompatible,
    upcomingDueJobs,
    showBatchRecommendation
  };
};
