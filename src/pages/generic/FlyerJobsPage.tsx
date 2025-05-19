
import { useGenericFlyerJobs } from "@/hooks/generic/useGenericFlyerJobs";
import { productConfigs } from "@/config/productTypes";
import GenericJobsPage from "@/components/generic/GenericJobsPage";

const FlyerJobsPage = () => {
  const config = productConfigs["Flyers"];
  
  // Create a wrapper function that returns the hook result with type conversion
  const jobsHookWrapper = () => {
    const hookResult = useGenericFlyerJobs();
    
    // Create a wrapper for fixBatchedJobsWithoutBatch that consistently returns a number
    const fixBatchedJobsWrapper = async (): Promise<number> => {
      try {
        const result = await hookResult.fixBatchedJobsWithoutBatch();
        return typeof result === 'number' ? result : 0;
      } catch (error) {
        console.error('Error in fixBatchedJobsWrapper:', error);
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
