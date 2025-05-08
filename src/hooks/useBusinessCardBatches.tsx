import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Job } from "@/components/business-cards/JobsTable";
import { toast } from "sonner";
import { 
  castToUUID, 
  processBatchData, 
  toSafeString, 
  safeDbMap 
} from "@/utils/database/dbHelpers";

export function useBusinessCardBatches() {
  const { user } = useAuth();
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBatches = async () => {
    if (!user) {
      console.log('No authenticated user for batch fetching');
      setIsLoading(false);
      return;
    }

    console.log('Fetching batches for user:', user.id);
    
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('batches')
        .select('*')
        .eq('created_by', castToUUID(user.id))
        .or('name.ilike.%-BC-%,name.ilike.DXB-BC-%')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      console.log('Batches data received:', data?.length || 0, 'records');
      
      if (data && Array.isArray(data)) {
        const processedBatches = data.map(batch => processBatchData(batch)).filter(Boolean);
        setBatches(processedBatches);
      }
    } catch (err) {
      console.error('Error fetching business card batches:', err);
      setError('Failed to load business card batches');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchBatches();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const deleteBatch = async (batchId: string) => {
    try {
      console.log(`Deleting batch ${batchId}`);
      
      // First, update all business card jobs linked to this batch to remove batch_id
      const { error: updateError } = await supabase
        .from('business_card_jobs')
        .update({ 
          status: "queued",
          batch_id: null 
        })
        .eq("batch_id", castToUUID(batchId));
      
      if (updateError) {
        console.error("Error unlinking jobs from batch:", updateError);
        toast.error("Failed to unlink jobs from batch");
        return;
      }

      // Then, delete the batch itself
      const { error: deleteError } = await supabase
        .from('batches')
        .delete()
        .eq("id", castToUUID(batchId));

      if (deleteError) {
        console.error("Error deleting batch:", deleteError);
        toast.error("Failed to delete batch");
        return;
      }

      toast.success("Batch deleted successfully");
      
      // Refresh batches
      await fetchBatches();
    } catch (error) {
      console.error("Error in batch deletion:", error);
      toast.error("An error occurred while deleting the batch");
    }
  };

  const viewPDF = (batch: any) => {
    if (batch && batch.front_pdf_url) {
      window.open(batch.front_pdf_url, '_blank');
    } else {
      toast.error("No PDF available for this batch");
    }
  };

  return { batches, isLoading, error, fetchBatches, deleteBatch, viewPDF };
}
