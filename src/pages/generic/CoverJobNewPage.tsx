
import { GenericJobForm } from "@/components/generic/GenericJobForm";
import { productConfigs } from "@/config/productTypes";
import { useSessionValidation } from "@/hooks/useSessionValidation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

const CoverJobNewPage = () => {
  const config = productConfigs["Covers"];
  const navigate = useNavigate();
  
  // Add session validation to ensure user is authenticated
  const { isValidating, isValid } = useSessionValidation();
  
  if (isValidating) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">
          Validating session...
        </span>
      </div>
    );
  }
  
  if (!isValid) {
    return (
      <div className="container mx-auto py-6 flex flex-col items-center justify-center">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Authentication Required</h2>
          <p className="mb-6">Please sign in to create cover jobs.</p>
          <Button 
            onClick={() => navigate('/auth')} 
            className="w-full"
          >
            Go to Sign In
          </Button>
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
