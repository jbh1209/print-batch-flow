
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { BaseJob, ProductConfig, LaminationType } from '@/config/productTypes';
import { toast } from 'sonner';

export function useBatchCreation(productType: string, tableName: string) {
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const { user } = useAuth();

  const createBatchWithSelectedJobs = async (
    selectedJobs: BaseJob[],
    config: ProductConfig,
    laminationType: LaminationType = "none",
    slaTargetDays: number = 3 // Add default slaTargetDays parameter
  ) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    if (selectedJobs.length === 0) {
      throw new Error('No jobs selected');
    }

    try {
      setIsCreatingBatch(true);
      
      // Generate batch number based on product type
      const batchNumber = await generateBatchNumber(productType);
      
      // Insert the batch record - remove product_type field as it doesn't exist in the table schema
      const { data: batch, error: batchError } = await supabase
        .from('batches')
        .insert({
          name: batchNumber,
          status: 'pending',
          created_by: user.id,
          lamination_type: laminationType,
          paper_type: config.availablePaperTypes?.[0] || null,
          paper_weight: config.availablePaperWeights?.[0] || null,
          sheets_required: calculateSheetsRequired(selectedJobs, config),
          sla_target_days: slaTargetDays // Add SLA target days to the database
        })
        .select()
        .single();

      if (batchError) throw batchError;
      
      // Update all jobs to be part of this batch
      const jobIds = selectedJobs.map(job => job.id);
      
      // Use type assertion to handle the tableName typing issue
      const { error: updateError } = await supabase
        .from(tableName as "business_card_jobs" | "flyer_jobs" | "postcard_jobs" | "sleeve_jobs")
        .update({
          batch_id: batch.id,
          status: 'batched'
        })
        .in('id', jobIds);
      
      if (updateError) throw updateError;
      
      toast.success(`Batch ${batchNumber} created with ${selectedJobs.length} jobs`);
      return batch;
    } catch (err) {
      console.error('Error creating batch:', err);
      toast.error(`Failed to create batch: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    } finally {
      setIsCreatingBatch(false);
    }
  };

  // Helper function to generate a batch number
  const generateBatchNumber = async (productType: string): Promise<string> => {
    try {
      // Get prefix based on product type
      const prefix = getProductPrefix(productType);
      
      // Get count of existing batches for this product type
      const { data, error } = await supabase
        .from('batches')
        .select('id')
        .eq('name', prefix); // Use the LIKE operator to find batches with similar prefix
      
      if (error) throw error;
      
      // Generate number with padding
      const batchCount = (data?.length || 0) + 1;
      const batchNumber = `${prefix}-${batchCount.toString().padStart(5, '0')}`;
      
      return batchNumber;
    } catch (err) {
      console.error('Error generating batch number:', err);
      return `${getProductPrefix(productType)}-${Date.now()}`;
    }
  };
  
  // Helper function to get product prefix
  const getProductPrefix = (productType: string): string => {
    const prefixMap: Record<string, string> = {
      'Business Cards': 'DXB-BC',
      'Flyers': 'DXB-FL',
      'Postcards': 'DXB-PC',
      'Posters': 'DXB-PO',
      'Sleeves': 'DXB-SL',
      'Boxes': 'DXB-BX',
      'Covers': 'DXB-CO',
      'Stickers': 'DXB-ST',
    };
    
    return prefixMap[productType] || `DXB-${productType.substring(0, 2).toUpperCase()}`;
  };
  
  // Helper to calculate sheets required
  const calculateSheetsRequired = (jobs: BaseJob[], config: ProductConfig): number => {
    // Basic implementation - can be made more sophisticated based on product type
    let totalSheets = 0;
    
    jobs.forEach(job => {
      // If quantity is available, use it as a base
      if ('quantity' in job && typeof job.quantity === 'number') {
        totalSheets += job.quantity;
      } else {
        // Default to at least 1 sheet per job
        totalSheets += 1;
      }
    });
    
    // Add a buffer (e.g., 10%)
    return Math.ceil(totalSheets * 1.1);
  };

  return {
    createBatchWithSelectedJobs,
    isCreatingBatch
  };
}
