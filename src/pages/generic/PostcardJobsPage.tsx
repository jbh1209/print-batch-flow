
import { productConfigs } from "@/config/productTypes";
import { useGenericJobs } from "@/hooks/generic/useGenericJobs";
import GenericJobsPage from "@/components/generic/GenericJobsPage";

const PostcardJobsPage = () => {
  const config = productConfigs["Postcards"];
  
  // Create a wrapper function that returns the hook result with type conversion
  const jobsHookWrapper = () => {
    const hookResult = useGenericJobs(config);
    
    // Create a wrapper for fixBatchedJobsWithoutBatch that matches expected return type
    const fixBatchedJobsWrapper = async () => {
      return await hookResult.fixBatchedJobsWithoutBatch();
    };
    
    return {
      ...hookResult,
      fixBatchedJobsWithoutBatch: fixBatchedJobsWrapper
    };
  };

  return <GenericJobsPage config={config} useJobsHook={jobsHookWrapper} />;
};

export default PostcardJobsPage;
