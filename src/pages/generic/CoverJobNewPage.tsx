
import { GenericJobForm } from "@/components/generic/GenericJobForm";
import { productConfigs } from "@/config/productTypes";

const CoverJobNewPage = () => {
  const config = productConfigs["Covers"];
  
  if (!config) {
    console.error('Cover config not found');
    return <div>Configuration error</div>;
  }
  
  return (
    <div className="container mx-auto py-6">
      <GenericJobForm config={config} mode="create" />
    </div>
  );
};

export default CoverJobNewPage;
