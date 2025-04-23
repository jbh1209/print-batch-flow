
import { productConfigs } from "@/config/productTypes";
import { GenericJobForm } from "@/components/generic/GenericJobForm";

const SleeveJobNewPage = () => {
  const config = productConfigs["Sleeves"];
  return <GenericJobForm config={config} mode="create" />;
};

export default SleeveJobNewPage;
