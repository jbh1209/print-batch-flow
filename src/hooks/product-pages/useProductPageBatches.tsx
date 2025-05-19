
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ProductPageBatch } from '@/components/product-pages/types/ProductPageTypes';

export function useProductPageBatches() {
  const [batches, setBatches] = useState<ProductPageBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchBatches = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('batches')
        .select(`
          *,
          product_pages:product_pages!inner(*)
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Filter to only include batches that have product_pages
      const productPageBatches = data?.filter(batch => batch.product_pages?.length > 0) || [];
      setBatches(productPageBatches);
    } catch (err) {
      console.error('Error fetching product page batches:', err);
      setError('Failed to load product page batches');
    } finally {
      setIsLoading(false);
    }
  };

  // Load batches when component mounts
  useEffect(() => {
    fetchBatches();
  }, []);

  // Delete a batch
  const deleteBatch = async (batchId: string) => {
    try {
      // First, update all jobs in this batch back to queued status
      const { error: updateError } = await supabase
        .from('product_pages')
        .update({ 
          status: 'queued',
          batch_id: null
        })
        .eq('batch_id', batchId);

      if (updateError) throw updateError;

      // Then delete the batch itself
      const { error: deleteError } = await supabase
        .from('batches')
        .delete()
        .eq('id', batchId);

      if (deleteError) throw deleteError;

      // Update local state
      setBatches(prevBatches => prevBatches.filter(b => b.id !== batchId));
      toast.success('Batch deleted successfully');
      return true;
    } catch (err) {
      console.error('Error deleting batch:', err);
      toast.error('Failed to delete batch');
      return false;
    }
  };

  // View batch details
  const handleViewBatchDetails = (batchId: string) => {
    navigate(`/batches/product-pages?batchId=${batchId}`);
  };

  // Open PDF in new tab
  const handleViewPDF = (pdfUrl: string) => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    } else {
      toast.error('No PDF available for this batch');
    }
  };

  return {
    batches,
    isLoading,
    error,
    fetchBatches,
    deleteBatch,
    handleViewBatchDetails,
    handleViewPDF
  };
}
