
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BatchSummary } from "@/components/batches/types/BatchTypes";

// Standardized mapping between batch prefix codes and product types
const BATCH_PREFIX_TO_PRODUCT_TYPE = {
  'BC': "Business Cards",
  'FL': "Flyers",
  'PC': "Postcards",
  'PB': "Boxes",
  'STK': "Stickers",
  'COV': "Covers",
  'POS': "Posters",
  'SL': "Sleeves"
};

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
      
      console.log("Fetching all batches");
      
      // Remove created_by filter to allow seeing all batches
      const { data, error } = await supabase
        .from("batches")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      console.log("Batches data received:", data?.length || 0, "records");
      
      // Process batch data to determine product type from standardized batch name
      const processedBatches = data?.map(batch => {
        // Extract product type from standardized batch name format: DXB-XX-##### 
        let productType = "Unknown";
        if (batch.name) {
          // Regex to match DXB-XX-##### format
          const match = batch.name.match(/DXB-([A-Z]+)-\d+/);
          if (match && match[1]) {
            const code = match[1];
            productType = BATCH_PREFIX_TO_PRODUCT_TYPE[code] || "Unknown";
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
    // Convert product type to URL format and use proper batchflow prefix
    switch(productType) {
      case "Business Cards": return "/batchflow/batches/business-cards";
      case "Flyers": return "/batchflow/batches/flyers";
      case "Postcards": return "/batchflow/batches/postcards";
      case "Boxes": return "/batchflow/batches/boxes";
      case "Stickers": return "/batchflow/batches/stickers";
      case "Covers": return "/batchflow/batches/covers";
      case "Posters": return "/batchflow/batches/posters";
      case "Sleeves": return "/batchflow/batches/sleeves";
      default: return "/batchflow/batches";
    }
  };

  const getBatchUrl = (batch: BatchSummary) => {
    // Generate proper URLs for batch details using the batchflow prefix
    const productPath = getProductUrl(batch.product_type);
    if (productPath === "/batchflow/batches") {
      return `/batchflow/batches`;
    }
    
    console.log(`Generating batch URL: ${productPath}/batches/${batch.id} for product type: ${batch.product_type}`);
    
    // Use the direct path pattern for all batch types with batchflow prefix
    return `${productPath}/batches/${batch.id}`;
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
