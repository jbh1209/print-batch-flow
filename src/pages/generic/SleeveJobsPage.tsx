
import { productConfigs } from "@/config/productTypes";
import { useGenericJobs } from "@/hooks/generic/useGenericJobs";
import GenericJobsPage from "@/components/generic/GenericJobsPage";

const SleeveJobsPage = () => {
  const config = productConfigs["Sleeves"];
  
  // Create a wrapper function that returns the hook result with type conversion
  const jobsHookWrapper = () => {
    const hookResult = useGenericJobs(config);
    
    // Create a wrapper for fixBatchedJobsWithoutBatch that returns a number as expected
    const fixBatchedJobsWrapper = async (): Promise<number> => {
      try {
        return await hookResult.fixBatchedJobsWithoutBatch();
      } catch (error) {
        console.error("Error fixing batched jobs:", error);
        return 0; // Return 0 on error
      }
    };
    
    return {
      ...hookResult,
      fixBatchedJobsWithoutBatch: fixBatchedJobsWrapper
    };
  };

  return <GenericJobsPage config={config} useJobsHook={jobsHookWrapper} />;
};

export default SleeveJobsPage;
