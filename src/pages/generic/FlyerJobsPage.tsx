
import { productConfigs } from "@/config/productTypes";
import { useGenericFlyerJobs } from "@/hooks/generic/useGenericFlyerJobs";
import GenericJobsPage from "@/components/generic/GenericJobsPage";
import { DebugInfo } from "@/components/ui/debug-info";

const FlyerJobsPage = () => {
  const config = productConfigs["Flyers"];
  
  console.log("FlyerJobsPage rendering");
  
  // Create a wrapper function that returns the hook result with standardized interface
  const jobsHookWrapper = () => {
    const hookResult = useGenericFlyerJobs();
    
    console.log("FlyerJobsPage hook wrapper executed, jobs:", hookResult.jobs.length);
    
    return {
      jobs: hookResult.jobs,
      isLoading: hookResult.isLoading,
      error: hookResult.error,
      deleteJob: hookResult.deleteJob,
      fetchJobs: hookResult.fetchJobs,
      createBatch: hookResult.createBatch,
      isCreatingBatch: hookResult.isCreatingBatch,
      fixBatchedJobsWithoutBatch: hookResult.fixBatchedJobsWithoutBatch,
      isFixingBatchedJobs: hookResult.isFixingBatchedJobs
    };
  };

  return <GenericJobsPage config={config} useJobsHook={jobsHookWrapper} />;
};

export default FlyerJobsPage;
