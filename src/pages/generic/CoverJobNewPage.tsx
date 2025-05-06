
import { GenericJobForm } from "@/components/generic/GenericJobForm";
import { productConfigs } from "@/config/productTypes";
import { useSessionValidation } from "@/hooks/useSessionValidation";

const CoverJobNewPage = () => {
  const config = productConfigs["Covers"];
  
  // Add session validation to ensure user is authenticated
  const { isValidating } = useSessionValidation();
  
  if (isValidating) {
    return <div className="flex items-center justify-center h-32">
      <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-primary rounded-full"></div>
    </div>;
  }
  
  return (
    <div className="container mx-auto py-6">
      <GenericJobForm config={config} mode="create" />
    </div>
  );
};

export default CoverJobNewPage;
