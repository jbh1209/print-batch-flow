
import { productConfigs } from "@/config/productTypes";
import { useGenericJobs } from "@/hooks/generic/useGenericJobs";
import GenericJobsPage from "@/components/generic/GenericJobsPage";

const SleeveJobsPage = () => {
  const config = productConfigs["Sleeves"];
  
  // Create a wrapper function that returns the hook result with the correct return type
  const jobsHookWrapper = () => {
    const hookResult = useGenericJobs(config);
    return {
      ...hookResult,
      // Ensure fixBatchedJobsWithoutBatch returns Promise<number>
      fixBatchedJobsWithoutBatch: hookResult.fixBatchedJobsWithoutBatch
    };
  };

  return <GenericJobsPage config={config} useJobsHook={jobsHookWrapper} />;
};

export default SleeveJobsPage;
