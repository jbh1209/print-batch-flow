
import { GenericJobForm } from "@/components/generic/GenericJobForm";
import { productConfigs } from "@/config/productTypes";

const PosterJobNewPage = () => {
  const config = productConfigs["Posters"];
  
  return (
    <div className="container mx-auto py-6">
      <GenericJobForm config={config} mode="create" />
    </div>
  );
};

export default PosterJobNewPage;
