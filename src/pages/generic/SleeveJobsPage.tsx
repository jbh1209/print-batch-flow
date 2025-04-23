
import { productConfigs } from "@/config/productTypes";
import { useGenericJobs } from "@/hooks/generic/useGenericJobs";
import GenericJobsPage from "@/components/generic/GenericJobsPage";

const SleeveJobsPage = () => {
  const config = productConfigs["Sleeves"];
  const jobsHook = useGenericJobs(config);

  return <GenericJobsPage config={config} useJobsHook={jobsHook} />;
};

export default SleeveJobsPage;
