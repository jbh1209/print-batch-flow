
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
      try {
        const result = await hookResult.fixBatchedJobsWithoutBatch();
        // If the original function returns void, return 0 to satisfy the type requirements
        return typeof result === 'number' ? result : 0;
      } catch (error) {
        console.error('Error in fixBatchedJobsWrapper:', error);
        // Return 0 if there's an error to maintain the contract
        return 0;
      }
    };
    
    return {
      ...hookResult,
      fixBatchedJobsWithoutBatch: fixBatchedJobsWrapper
    };
  };

  return <GenericJobsPage config={config} useJobsHook={jobsHookWrapper} />;
};

export default FlyerJobsPage;
