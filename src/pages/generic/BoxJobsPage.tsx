
import { productConfigs } from "@/config/productTypes";
import { useGenericJobs } from "@/hooks/generic/useGenericJobs";
import GenericJobsPage from "@/components/generic/GenericJobsPage";

const BoxJobsPage = () => {
  const config = productConfigs["Boxes"];
  
  // Create a wrapper function that returns the hook result with type conversion
  const jobsHookWrapper = () => {
    const hookResult = useGenericJobs(config);
    
    // Return the hook result with all required properties
    return {
      ...hookResult,
      fixBatchedJobsWithoutBatch: async () => {
        return await hookResult.fixBatchedJobsWithoutBatch();
      }
    };
  };

  return <GenericJobsPage config={config} useJobsHook={jobsHookWrapper} />;
};

export default BoxJobsPage;
