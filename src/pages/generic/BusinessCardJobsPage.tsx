
import { productConfigs } from "@/config/productTypes";
import GenericJobsPage from "@/components/generic/GenericJobsPage";
import { useGenericJobs } from "@/hooks/generic/useGenericJobs";

const BusinessCardJobsPage = () => {
  const config = productConfigs["Business Cards"];
  
  // Create a wrapper function that returns the hook result
  const jobsHookWrapper = () => {
    const hookResult = useGenericJobs(config);
    
    return hookResult;
  };

  return <GenericJobsPage config={config} useJobsHook={jobsHookWrapper} />;
};

export default BusinessCardJobsPage;
