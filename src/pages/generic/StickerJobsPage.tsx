
import { productConfigs } from "@/config/productTypes";
import { useGenericJobs } from "@/hooks/generic/useGenericJobs";
import GenericJobsPage from "@/components/generic/GenericJobsPage";

const StickerJobsPage = () => {
  const config = productConfigs["Stickers"];
  
  // Create a wrapper function that returns the hook result
  const jobsHookWrapper = () => useGenericJobs(config);

  return <GenericJobsPage config={config} useJobsHook={jobsHookWrapper} />;
};

export default StickerJobsPage;
