
import { useGenericJobs } from "./useGenericJobs";
import { productConfigs, BaseJob } from "@/config/productTypes";

// Create a wrapper function that correctly implements the required interface
export function useGenericFlyerJobs() {
  const config = productConfigs["Flyers"];
  
  // Use concrete type instead of generic to avoid deep type instantiation
  const jobsHook = useGenericJobs(config);
  
  // Return the hook with properly typed methods to match the expected interface
  return {
    jobs: jobsHook.jobs,
    isLoading: jobsHook.isLoading,
    error: jobsHook.error,
    deleteJob: jobsHook.deleteJob,
    fetchJobs: jobsHook.fetchJobs,
    createBatch: jobsHook.createBatch,
    isCreatingBatch: jobsHook.isCreatingBatch,
    fixBatchedJobsWithoutBatch: jobsHook.fixBatchedJobsWithoutBatch,
    isFixingBatchedJobs: jobsHook.isFixingBatchedJobs
  };
}
