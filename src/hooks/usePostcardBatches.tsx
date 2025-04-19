
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { PostcardBatch } from '@/components/batches/types/PostcardTypes';
import { toast } from 'sonner';

export function usePostcardBatches(batchId?: string | null) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [batches, setBatches] = useState<PostcardBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);

  const fetchBatches = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('batches')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Filter only postcard batches by name pattern and convert to PostcardBatch type
      const postcardBatches = data?.filter(batch => 
        batch.name && batch.name.startsWith('DXB-PC-')
      ).map(batch => ({
        id: batch.id,
        name: batch.name,
        status: batch.status,
        paper_type: batch.paper_type as "350gsm Matt" | "350gsm Gloss",
        lamination_type: batch.lamination_type,
        created_at: batch.created_at,
        due_date: batch.due_date,
        sheets_required: batch.sheets_required,
        created_by: batch.created_by,
        updated_at: batch.updated_at,
        front_pdf_url: batch.front_pdf_url,
        back_pdf_url: batch.back_pdf_url
      })) || [];

      setBatches(postcardBatches);
    } catch (err) {
      console.error('Error fetching postcard batches:', err);
      setError('Failed to load batches');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [user]);

  const handleViewPDF = async (pdfUrl: string) => {
    // Implement PDF viewing logic here
    window.open(pdfUrl, '_blank');
  };

  const handleDeleteBatch = async () => {
    if (!batchToDelete) return;
    
    try {
      setIsDeleting(true);
      
      // Update all jobs to remove them from the batch
      const { error: updateError } = await supabase
        .from('postcard_jobs')
        .update({ 
          batch_id: null,
          status: 'queued'
        })
        .eq('batch_id', batchToDelete);
      
      if (updateError) throw updateError;
      
      // Delete the batch
      const { error: deleteError } = await supabase
        .from('batches')
        .delete()
        .eq('id', batchToDelete);
      
      if (deleteError) throw deleteError;
      
      toast.success('Batch deleted successfully');
      fetchBatches();
      setBatchToDelete(null);
    } catch (error) {
      console.error('Error deleting batch:', error);
      toast.error('Failed to delete batch');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewBatchDetails = (batchId: string) => {
    navigate(`/batches/postcards/batches?batchId=${batchId}`);
  };

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
