
import { useGenericJobs } from "@/hooks/generic/useGenericJobs";
import { productConfigs } from "@/config/productTypes";
import GenericJobsPage from "@/components/generic/GenericJobsPage";

const BusinessCardJobsPage = () => {
  const config = productConfigs["Business Cards"];
  
  // Create a wrapper function that returns the hook result with type conversion
  const jobsHookWrapper = () => {
    const hookResult = useGenericJobs({
      productType: "Business Cards",
      tableName: "business_card_jobs"
    });
    
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

export default BusinessCardJobsPage;
