
import { productConfigs } from "@/config/productTypes";
import GenericJobEdit from "@/pages/GenericJobEdit";

const CoverJobEditPage = () => {
  const config = productConfigs["Covers"];
  return <GenericJobEdit config={config} />;
};

export default CoverJobEditPage;
