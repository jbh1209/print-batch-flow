
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
      
      console.log("Fetching batches for user:", user.id);
      
      const { data, error } = await supabase
        .from("batches")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      console.log("Batches data received:", data?.length || 0, "records");
      
      // Determine product type from batch name
      const processedBatches = data?.map(batch => {
        const nameParts = batch.name.split('-');
        let productType = "Unknown";
        
        if (nameParts.length >= 2) {  // Changed to >= 2 to correctly parse all prefixes
          const prefix = nameParts[0];
          const code = nameParts[1];
          
          // Check for both DXB-BC and BC formats
          if (prefix === "DXB") {
            switch(code) {
              case "BC": productType = "Business Cards"; break;
              case "FL": productType = "Flyers"; break;
              case "PC": productType = "Postcards"; break;
              case "PB": productType = "Product Boxes"; break;
              case "ZUND": productType = "Zund Stickers"; break;
              case "COV": productType = "Covers"; break;
              case "POST": productType = "Posters"; break;
              case "SL": productType = "Sleeves"; break;
            }
          } else {
            // Handle legacy format or other formats
            switch(prefix) {
              case "BC": productType = "Business Cards"; break;
              case "FL": productType = "Flyers"; break;
              case "PC": productType = "Postcards"; break;
              case "PB": productType = "Product Boxes"; break;
              case "ZUND": productType = "Zund Stickers"; break;
              case "COV": productType = "Covers"; break;
              case "POST": productType = "Posters"; break;
              case "SL": productType = "Sleeves"; break;
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
      case "Product Boxes": return "/batches/boxes/batches";
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
