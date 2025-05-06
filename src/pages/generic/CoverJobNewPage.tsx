
import { GenericJobForm } from "@/components/generic/GenericJobForm";
import { productConfigs } from "@/config/productTypes";
import { useSessionValidation } from "@/hooks/useSessionValidation";
import { toast } from "sonner";

const CoverJobNewPage = () => {
  const config = productConfigs["Covers"];
  
  // Add session validation to ensure user is authenticated
  const { isValidating, isValid } = useSessionValidation();
  
  if (isValidating) {
    return <div className="flex items-center justify-center h-32">
      <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-primary rounded-full"></div>
    </div>;
  }
  
  if (!isValid) {
    toast.error("Authentication required to create jobs");
    return (
      <div className="container mx-auto py-6 flex flex-col items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Authentication Required</h2>
          <p>Please sign in to create cover jobs.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-6">
      <GenericJobForm config={config} mode="create" />
    </div>
  );
};

export default CoverJobNewPage;
