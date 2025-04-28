import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { FlyerBatch } from '@/components/batches/types/FlyerTypes';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { handlePdfAction } from '@/utils/pdfActionUtils';

export function useFlyerBatches(batchId: string | null = null) {
  const { user } = useAuth();
  const [batches, setBatches] = useState<FlyerBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  const fetchBatches = async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      // Use the "batches" table but filter by created_by and include only flyer batches
      let query = supabase
        .from('batches')
        .select('*')
        .eq('created_by', user.id)
        .filter('name', 'ilike', 'DXB-FL-%'); // Only fetch flyer batches (prefix DXB-FL-)
      
      // If batchId is specified, filter to only show that batch
      if (batchId) {
        query = query.eq("id", batchId);
      }
      
      const { data, error: fetchError } = await query
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Convert to FlyerBatch type and ensure all required properties exist
      const flyerBatches: FlyerBatch[] = (data || []).map(batch => {
        // Make sure to include overview_pdf_url property
        return {
          id: batch.id,
          name: batch.name,
          status: batch.status,
          sheets_required: batch.sheets_required,
          front_pdf_url: batch.front_pdf_url,
          back_pdf_url: batch.back_pdf_url,
          overview_pdf_url: batch.overview_pdf_url || null, // Add proper handling for overview_pdf_url
          due_date: batch.due_date,
          created_at: batch.created_at,
          lamination_type: batch.lamination_type,
          paper_type: batch.paper_type,
          paper_weight: batch.paper_weight,
          sheet_size: batch.sheet_size,
          printer_type: batch.printer_type,
          created_by: batch.created_by,
          updated_at: batch.updated_at,
          date_created: batch.date_created
        } as FlyerBatch;
      });
      
      setBatches(flyerBatches);
      
      // If we're looking for a specific batch and didn't find it
      if (batchId && (!data || data.length === 0)) {
        toast.error("Batch not found or you don't have permission to view it.");
      }
    } catch (err) {
      console.error('Error fetching flyer batches:', err);
      setError('Failed to load flyer batches');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleViewPDF = (url: string | null) => {
    if (!url) {
      toast.error('No PDF available to view');
      return;
    }
    
    handlePdfAction(url, 'view');
  };

  const handleViewBatchDetails = (batchId: string) => {
    // Update to use path parameter instead of query parameter
    navigate(`/batches/flyers/batches/${batchId}`);
  };
  
  const handleDeleteBatch = async () => {
    if (!batchToDelete) return;
    
    setIsDeleting(true);
    try {
      console.log("Deleting batch:", batchToDelete);
      
      // First reset all jobs in this batch back to queued
      const { error: jobsError } = await supabase
        .from("flyer_jobs")
        .update({ 
          status: "queued",  // Reset status to queued
          batch_id: null     // Clear batch_id reference
        })
        .eq("batch_id", batchToDelete);
      
      if (jobsError) {
        console.error("Error resetting jobs in batch:", jobsError);
        throw jobsError;
      }
      
      // Then delete the batch
      const { error: deleteError } = await supabase
        .from("batches")
        .delete()
        .eq("id", batchToDelete);
      
      if (deleteError) {
        console.error("Error deleting batch:", deleteError);
        throw deleteError;
      }
      
      console.log("Batch deleted successfully");
      
      toast.success("Batch deleted and its jobs returned to queue");
      
      // Refresh batch list
      fetchBatches();
    } catch (error) {
      console.error("Error deleting batch:", error);
      toast.error("Failed to delete batch. Please try again.");
    } finally {
      setIsDeleting(false);
      setBatchToDelete(null);
    }
  };
  
  useEffect(() => {
    fetchBatches();
  }, [user, batchId]);
  
  return {
    batches,
    isLoading,
    error,
    batchToDelete,
    isDeleting,
    fetchBatches,
    handleViewPDF,
    handleDeleteBatch,
    handleViewBatchDetails,
    setBatchToDelete
  };
}
