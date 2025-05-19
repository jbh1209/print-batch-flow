
import { useGenericFlyerJobs } from "@/hooks/generic/useGenericFlyerJobs";
import { productConfigs } from "@/config/productTypes";
import GenericJobsPage from "@/components/generic/GenericJobsPage";

const FlyerJobsPage = () => {
  const config = productConfigs["Flyers"];
  
  // Create a wrapper function that returns the hook result with type conversion
  const jobsHookWrapper = () => {
    const hookResult = useGenericFlyerJobs();
    
    // Create a wrapper for fixBatchedJobsWithoutBatch that returns a number to match expected return type
    const fixBatchedJobsWrapper = async (): Promise<number> => {
      await hookResult.fixBatchedJobsWithoutBatch();
      // Return 0 to indicate that the operation has completed
      return 0;
    };
    
    return {
      ...hookResult,
      fixBatchedJobsWithoutBatch: fixBatchedJobsWrapper
    };
  };

  return <GenericJobsPage config={config} useJobsHook={jobsHookWrapper} />;
};

export default FlyerJobsPage;
