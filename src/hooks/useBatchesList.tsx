
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface BatchSummary {
  id: string;
  name: string;
  due_date: string;
  status: string;
  product_type: string;
  sheets_required: number;
}

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
        // Extract product type from standardized batch name format: DXB-BC-00001
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
    // Convert spaces to dashes and make lowercase for proper URL format
    const formattedType = productType.toLowerCase().replace(/ /g, '-');
    switch(productType) {
      case "Business Cards": return "/batches/business-cards/batches";
      case "Flyers": return "/batches/flyers/batches";
      case "Postcards": return "/batches/postcards/batches";
      case "Product Boxes": 
      case "Boxes": return "/batches/boxes/batches";
      case "Stickers": return "/batches/stickers/batches";
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
