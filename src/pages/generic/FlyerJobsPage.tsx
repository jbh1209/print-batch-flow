
import { useGenericFlyerJobs } from "@/hooks/generic/useGenericFlyerJobs";
import { productConfigs } from "@/config/productTypes";
import GenericJobsPage from "@/components/generic/GenericJobsPage";

const FlyerJobsPage = () => {
  const config = productConfigs["Flyers"];
  
  // Create a wrapper function that returns the hook result with type conversion
  const jobsHookWrapper = () => {
    const hookResult = useGenericFlyerJobs();
    
    // Create a wrapper for fixBatchedJobsWithoutBatch that matches expected return type
    const fixBatchedJobsWrapper = async () => {
      await hookResult.fixBatchedJobsWithoutBatch();
      // Return type is void as expected
    };
    
    return {
      ...hookResult,
      fixBatchedJobsWithoutBatch: fixBatchedJobsWrapper
    };
  };

  return <GenericJobsPage config={config} useJobsHook={jobsHookWrapper} />;
};

export default FlyerJobsPage;
