
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { FlyerBatch, FlyerJob } from '@/components/batches/types/FlyerTypes';
import { toast } from 'sonner';

export function useFlyerBatches() {
  const { user } = useAuth();
  const [batches, setBatches] = useState<FlyerBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBatches = async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      // Use the "batches" table but filter by created_by
      const { data, error } = await supabase
        .from('batches')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Convert to FlyerBatch type
      const flyerBatches: FlyerBatch[] = data || [];
      setBatches(flyerBatches);
    } catch (err) {
      console.error('Error fetching flyer batches:', err);
      setError('Failed to load flyer batches');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [user]);

  const createBatch = async (selectedJobs: FlyerJob[], batchData: Omit<FlyerBatch, 'id' | 'created_at' | 'sheets_required' | 'created_by'>) => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      // Calculate sheets required based on job quantities and sizes
      const sheetsRequired = calculateSheetsRequired(selectedJobs);
      
      // Create the batch
      const { data, error: batchError } = await supabase
        .from('batches')
        .insert({
          ...batchData,
          sheets_required: sheetsRequired,
          created_by: user.id,
          // Add required fields for compatibility with the batches table
          lamination_type: 'none'
        })
        .select()
        .single();
      
      if (batchError) throw batchError;
      
      // Update all selected jobs to be part of this batch
      const jobIds = selectedJobs.map(job => job.id);
      const { error: updateError } = await supabase
        .from('flyer_jobs')
        .update({ 
          batch_id: data.id,
          status: 'batched' 
        })
        .in('id', jobIds);
      
      if (updateError) throw updateError;
      
      // Refresh the batch list
      fetchBatches();
      
      return data;
    } catch (err) {
      console.error('Error creating flyer batch:', err);
      throw err;
    }
  };
  
  // Helper function to calculate sheets required based on job quantities and sizes
  const calculateSheetsRequired = (jobs: FlyerJob[]): number => {
    // This is a simplified calculation that can be enhanced based on actual printing requirements
    let totalSheets = 0;
    
    for (const job of jobs) {
      // Calculate sheets based on size and quantity
      let sheetsPerJob = 0;
      
      switch (job.size) {
        case 'A5':
          // Assuming 2 A5s per sheet
          sheetsPerJob = Math.ceil(job.quantity / 2);
          break;
        case 'A4':
          // Assuming 1 A4 per sheet
          sheetsPerJob = job.quantity;
          break;
        case 'DL':
          // Assuming 3 DLs per sheet
          sheetsPerJob = Math.ceil(job.quantity / 3);
          break;
        case 'A3':
          // Assuming 1 A3 per sheet (special case)
          sheetsPerJob = job.quantity * 1.5; // A3 might require more paper
          break;
        default:
          sheetsPerJob = job.quantity;
      }
      
      totalSheets += sheetsPerJob;
    }
    
    // Add some extra sheets for setup and testing
    totalSheets = Math.ceil(totalSheets * 1.1); // 10% extra
    
    return totalSheets;
  };
  
  const handleViewPDF = (url: string | null) => {
    if (!url) {
      toast.error('No PDF available to view');
      return;
    }
    
    window.open(url, '_blank');
  };
  
  return {
    batches,
    isLoading,
    error,
    fetchBatches,
    createBatch,
    handleViewPDF
  };
}
