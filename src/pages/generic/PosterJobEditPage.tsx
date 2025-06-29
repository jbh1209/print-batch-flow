
import { productConfigs } from "@/config/productTypes";
import GenericJobEdit from "@/pages/GenericJobEdit";

const PosterJobEditPage = () => {
  const config = productConfigs["Posters"];
  return <GenericJobEdit config={config} />;
};

export default PosterJobEditPage;
