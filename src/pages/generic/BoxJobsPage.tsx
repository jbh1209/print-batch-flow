
import { productConfigs } from "@/config/productTypes";
import { useGenericJobs } from "@/hooks/generic/useGenericJobs";
import GenericJobsPage from "@/components/generic/GenericJobsPage";

const BoxJobsPage = () => {
  const config = productConfigs["Boxes"];
  
  // Create a wrapper function that returns the hook result
  const jobsHookWrapper = () => useGenericJobs(config);

  return <GenericJobsPage config={config} useJobsHook={jobsHookWrapper} />;
};

export default BoxJobsPage;
