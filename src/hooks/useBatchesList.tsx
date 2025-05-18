
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CODE_TO_PRODUCT_TYPE, extractProductCodeFromBatchName } from "@/utils/batch/productTypeCodes";

interface BatchSummary {
  id: string;
  name: string;
  due_date: string;
  status: string;
  product_type: string;
  sheets_required: number;
}

export const useBatchesList = () => {
  const { user } = useAuth();
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBatches = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!user) {
        console.log("No authenticated user found");
        setIsLoading(false);
        return;
      }
      
      console.log("Fetching all batches (team view)");
      
      const { data, error } = await supabase
        .from("batches")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      console.log("Batches data received:", data?.length || 0, "records");
      if (data && data.length > 0) {
        console.log("Sample batch names:", data.slice(0, 5).map(b => b.name).join(', '));
      }
      
      // Process batch data to determine product type from standardized batch name
      const processedBatches = data?.map(batch => {
        // Extract product type from batch name using helper function
        let productType = "Unknown";
        
        if (batch.name) {
          const code = extractProductCodeFromBatchName(batch.name);
          if (code) {
            productType = CODE_TO_PRODUCT_TYPE[code] || "Unknown";
            console.log(`Batch ${batch.name} with code ${code} detected as: ${productType}`);
          } else {
            console.warn(`Could not extract product code from batch name: ${batch.name}`);
            
            // Try simple substring matching as a fallback
            for (const [code, type] of Object.entries(CODE_TO_PRODUCT_TYPE)) {
              if (batch.name.includes(code)) {
                productType = type;
                console.log(`Fallback detection: Batch ${batch.name} contains code ${code}, detected as: ${productType}`);
                break;
              }
            }
          }
        }
        
        return {
          ...batch,
          product_type: productType
        };
      });
      
      setBatches(processedBatches || []);
    } catch (error) {
      console.error("Error fetching batches:", error);
      setError("Failed to load batch data");
      toast.error("Error loading batches", {
        description: "Failed to load batch data. Please try again."
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [user]);

  const getProductUrl = (productType: string) => {
    // Convert spaces to dashes and make lowercase for proper URL format
    const formattedType = productType.toLowerCase().replace(/ /g, '-');
    switch(productType) {
      case "Business Cards": return "/batches/business-cards/batches";
      case "Flyers": return "/batches/flyers/batches";
      case "Postcards": return "/batches/postcards/batches";
      case "Product Boxes": 
      case "Boxes": return "/batches/boxes/batches";
      case "Stickers": 
      case "Zund Stickers": return "/batches/stickers/batches";
      case "Covers": return "/batches/covers/batches";
      case "Posters": return "/batches/posters/batches";
      case "Sleeves": 
      case "Shipper Box Sleeves": return "/batches/sleeves/batches";
      default: return "/batches/all";
    }
  };

  const getBatchUrl = (batch: BatchSummary) => {
    // Generate proper URLs for batch details
    const productPath = getProductUrl(batch.product_type);
    if (productPath === "/batches/all") {
      return `/batches`;
    }
    
    // Use the direct path pattern for all batch types
    return `${productPath}/${batch.id}`;
  };

  return {
    batches,
    isLoading,
    error,
    fetchBatches,
    getProductUrl,
    getBatchUrl
  };
};
