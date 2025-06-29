
import { productConfigs } from "@/config/productTypes";
import GenericJobEdit from "@/pages/GenericJobEdit";

const BoxJobEditPage = () => {
  const config = productConfigs["Boxes"];
  return <GenericJobEdit config={config} />;
};

export default BoxJobEditPage;
