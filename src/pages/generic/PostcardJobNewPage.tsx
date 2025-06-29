
import { GenericJobForm } from "@/components/generic/GenericJobForm";
import { productConfigs } from "@/config/productTypes";

const PostcardJobNewPage = () => {
  const config = productConfigs["Postcards"];
  
  return (
    <div className="container mx-auto py-6">
      <GenericJobForm config={config} mode="create" />
    </div>
  );
};

export default PostcardJobNewPage;
