
import { productConfigs } from "@/config/productTypes";
import GenericJobEdit from "@/pages/GenericJobEdit";

const PostcardJobEditPage = () => {
  const config = productConfigs["Postcards"];
  return <GenericJobEdit config={config} />;
};

export default PostcardJobEditPage;
