
import { useGenericFlyerJobs } from "@/hooks/generic/useGenericFlyerJobs";
import { productConfigs } from "@/config/productTypes";
import GenericJobsPage from "@/components/generic/GenericJobsPage";

const FlyerJobsPage = () => {
  const config = productConfigs["Flyers"];
  
  return (
    <GenericJobsPage 
      config={config}
      useJobsHook={useGenericFlyerJobs}
    />
  );
};

export default FlyerJobsPage;
