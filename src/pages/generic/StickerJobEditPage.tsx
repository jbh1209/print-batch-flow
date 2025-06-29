
import { productConfigs } from "@/config/productTypes";
import GenericJobEdit from "@/pages/GenericJobEdit";

const StickerJobEditPage = () => {
  const config = productConfigs["Stickers"];
  return <GenericJobEdit config={config} />;
};

export default StickerJobEditPage;
