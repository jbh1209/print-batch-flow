
import { GenericJobForm } from "@/components/generic/GenericJobForm";
import { productConfigs } from "@/config/productTypes";

const StickerJobNewPage = () => {
  const config = productConfigs["Stickers"];
  
  return (
    <div className="container mx-auto py-6">
      <GenericJobForm config={config} mode="create" />
    </div>
  );
};

export default StickerJobNewPage;
