
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { handlePdfAction } from "@/utils/pdfActionUtils";
import { BatchStatus } from "@/config/productTypes";

interface Batch {
  id: string;
  name: string;
  lamination_type: string;
  sheets_required: number;
  front_pdf_url: string | null;
  back_pdf_url: string | null;
  due_date: string;
  created_at: string;
  status: BatchStatus;
}

export const useBusinessCardBatches = (batchId: string | null) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchBatches = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!user) {
        console.log("No authenticated user found for business card batches");
        setIsLoading(false);
        return;
      }
      
      console.log("Fetching business card batches");
      
      let query = supabase
        .from("batches")
        .select("*")
        .filter('name', 'ilike', 'DXB-BC-%'); // Only fetch business card batches (prefix DXB-BC-)
        
      // If batchId is specified, filter to only show that batch
      if (batchId) {
        query = query.eq("id", batchId);
      }
      
      const { data, error } = await query.order("created_at", { ascending: false });
      
      if (error) {
        console.error("Supabase error fetching batches:", error);
        throw error;
      }
      
      console.log("Business card batches received:", data?.length || 0, "records");
      
      setBatches(data || []);
    } catch (error) {
      console.error("Error fetching batches:", error);
      setError("Failed to load batch data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewPDF = (url: string | null) => {
    handlePdfAction(url, 'view');
  };

  const handleViewBatchDetails = (batchId: string) => {
    navigate(`/batches/business-cards/batches?batchId=${batchId}`);
  };

  useEffect(() => {
    fetchBatches();
  }, [user, batchId]);

  return {
    batches,
    isLoading,
    error,
    fetchBatches,
    handleViewPDF,
    handleViewBatchDetails
  };
};
