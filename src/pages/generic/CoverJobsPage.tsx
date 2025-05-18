
import { productConfigs } from "@/config/productTypes";
import { useGenericJobs } from "@/hooks/generic/useGenericJobs";
import GenericJobsPage from "@/components/generic/GenericJobsPage";

const CoverJobsPage = () => {
  const config = productConfigs["Covers"];
  
  // Create a wrapper function that returns the hook result with type conversion
  const jobsHookWrapper = () => {
    const hookResult = useGenericJobs(config);
    
    // Return the hook result with all required properties
    return hookResult;
  };

  return <GenericJobsPage config={config} useJobsHook={jobsHookWrapper} />;
};

export default CoverJobsPage;
