
import { GenericJobForm } from "@/components/generic/GenericJobForm";
import { productConfigs } from "@/config/productTypes";
import { useSessionValidation } from "@/hooks/useSessionValidation";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const CoverJobNewPage = () => {
  const config = productConfigs["Covers"];
  const navigate = useNavigate();
  const [isPreparingStorage, setIsPreparingStorage] = useState(false);
  
  // Add session validation to ensure user is authenticated
  const { isValidating, isValid, userId } = useSessionValidation();
  
  useEffect(() => {
    // Check if storage bucket exists when the component mounts
    if (isValid && userId) {
      const checkAndPrepareBucket = async () => {
        try {
          setIsPreparingStorage(true);
          
          // First check if the 'pdf_files' bucket exists
          const { data: buckets, error: listError } = await supabase.storage.listBuckets();
          
          if (listError) {
            console.error("Error listing buckets:", listError);
            return;
          }
          
          const bucketExists = buckets?.some(bucket => bucket.name === 'pdf_files');
          
          if (!bucketExists) {
            console.log("Attempting to create pdf_files bucket...");
            // Call our edge function to create the bucket
            const { error } = await supabase.functions.invoke('create_bucket', {
              body: { bucket_name: 'pdf_files' }
            });
            
            if (error) {
              console.error("Error creating bucket via function:", error);
              toast.error("Failed to create storage bucket. Admin setup may be required.");
            } else {
              console.log("Storage bucket created successfully");
            }
          } else {
            console.log("pdf_files bucket already exists");
          }
        } catch (error) {
          console.error("Error preparing storage:", error);
          toast.error("Error preparing file storage. Please try again.");
        } finally {
          setIsPreparingStorage(false);
        }
      };
      
      checkAndPrepareBucket();
    }
  }, [isValid, userId]);
  
  if (isValidating || isPreparingStorage) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">
          {isValidating ? "Validating session..." : "Preparing file storage..."}
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
