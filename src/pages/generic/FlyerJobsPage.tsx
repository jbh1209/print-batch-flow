
import { useGenericFlyerJobs } from "@/hooks/generic/useGenericFlyerJobs";
import { productConfigs } from "@/config/productTypes";
import GenericJobsPage from "@/components/generic/GenericJobsPage";

const FlyerJobsPage = () => {
  const config = productConfigs["Flyers"];
  
  // Create a wrapper function that returns the hook result with type conversion
  const jobsHookWrapper = () => {
    const hookResult = useGenericFlyerJobs();
    
    // Return all required properties
    return hookResult;
  };

  return <GenericJobsPage config={config} useJobsHook={jobsHookWrapper} />;
};

export default FlyerJobsPage;
