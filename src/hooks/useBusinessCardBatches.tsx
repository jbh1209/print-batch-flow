
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LaminationType } from "@/components/business-cards/JobsTable";
import { BatchStatus } from "@/config/productTypes";
import { handlePdfAction } from "@/utils/pdfActionUtils";

interface Batch {
  id: string;
  name: string;
  lamination_type: LaminationType;
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
  const { toast } = useToast();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBatches = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!user) {
        setIsLoading(false);
        return;
      }
      
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
      
      setBatches(data || []);
      
      // If we're looking for a specific batch and didn't find it
      if (batchId && (!data || data.length === 0)) {
        toast({
          title: "Batch not found",
          description: "The requested batch could not be found or you don't have permission to view it.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching batches:", error);
      setError("Failed to load batch data");
      toast({
        title: "Error loading batches",
        description: "Failed to load batch data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewPDF = (url: string | null) => {
    handlePdfAction(url, 'view');
  };

  const handleViewBatchDetails = (batchId: string) => {
    navigate(`/batchflow/batches/business-cards/batches/${batchId}`);
  };

  // Set up real-time subscriptions for batch changes
  useEffect(() => {
    if (!user) return;
    
    const channel = supabase
      .channel('business-card-batches-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'batches',
          filter: 'name=ilike.DXB-BC-%'
        },
        (payload) => {
          
          if (payload.eventType === 'DELETE') {
            // Remove deleted batch from state
            setBatches(prevBatches => 
              prevBatches.filter(batch => batch.id !== payload.old.id)
            );
          } else if (payload.eventType === 'INSERT') {
            // Add new batch to state
            setBatches(prevBatches => [payload.new as Batch, ...prevBatches]);
          } else if (payload.eventType === 'UPDATE') {
            // Update existing batch in state
            setBatches(prevBatches => 
              prevBatches.map(batch => 
                batch.id === payload.new.id ? payload.new as Batch : batch
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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
