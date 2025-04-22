
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BaseJob, BaseBatch, ProductConfig, LaminationType } from '@/config/productTypes';

export function useGenericBatch<T extends BaseJob>(config: ProductConfig) {
  const { user } = useAuth();
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

  // Create a batch with selected jobs
  const createBatchWithSelectedJobs = async (
    selectedJobs: T[], 
    batchProperties: {
      paperType?: string;
      paperWeight?: string;
      laminationType?: LaminationType;
      printerType?: string;
      sheetSize?: string;
    }
  ) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    if (selectedJobs.length === 0) {
      throw new Error('No jobs selected');
    }

    try {
      setIsCreatingBatch(true);
      
      // Calculate sheets required based on job quantities and sizes
      const sheetsRequired = calculateSheetsRequired(selectedJobs);
      
      // Generate a batch number format specific to the product type
      const batchNumber = await generateBatchNumber(config.productType);
      
      // Convert lamination type to a known type to satisfy TypeScript
      const laminationType: LaminationType = (batchProperties.laminationType || "none") as LaminationType;
      
      // Create the batch
      const { data: batchData, error: batchError } = await supabase
        .from('batches')
        .insert({
          name: batchNumber,
          paper_type: batchProperties.paperType || null,
          paper_weight: batchProperties.paperWeight || null,
          lamination_type: laminationType,
          due_date: new Date().toISOString(), // Default to current date
          printer_type: batchProperties.printerType || "HP 12000",
          sheet_size: batchProperties.sheetSize || "530x750mm",
          sheets_required: sheetsRequired,
          created_by: user.id,
          status: 'pending'
        })
        .select()
        .single();
        
      if (batchError) throw batchError;
      
      // Update all selected jobs to be part of this batch
      const jobIds = selectedJobs.map(job => job.id);
      const { error: updateError } = await supabase
        .from(config.tableName)
        .update({ 
          batch_id: batchData.id,
          status: 'batched' 
        })
        .in('id', jobIds);
      
      if (updateError) throw updateError;
      
      toast.success(`Batch ${batchNumber} created with ${selectedJobs.length} jobs`);
      return batchData as BaseBatch;
      
    } catch (err) {
      console.error(`Error creating ${config.productType} batch:`, err);
      toast.error('Failed to create batch');
      throw err;
    } finally {
      setIsCreatingBatch(false);
    }
  };

  // Helper function to calculate sheets required based on job type
  const calculateSheetsRequired = (jobs: T[]): number => {
    let totalSheets = 0;
    
    for (const job of jobs) {
      let sheetsPerJob = 0;
      
      // Calculate differently based on product type
      if (config.productType === "Flyers") {
        // Use existing flyer calculation logic
        const jobSize = job.size as string | undefined;
        if (jobSize) {
          switch (jobSize) {
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
        } else {
          sheetsPerJob = job.quantity;
        }
      } else {
        // Default calculation for other product types
        // Use a simple multiplier based on quantity
        sheetsPerJob = job.quantity;
      }
      
      totalSheets += sheetsPerJob;
    }
    
    // Add some extra sheets for setup and testing
    totalSheets = Math.ceil(totalSheets * 1.1); // 10% extra
    
    return totalSheets;
  };

  // Generate a batch number with format DXB-XX-00001 specific to product type
  const generateBatchNumber = async (productType: string): Promise<string> => {
    try {
      // Get product code for batch prefix
      const productCode = getProductCode(productType);
      
      // Get the count of existing batches for this product type
      const { data, error } = await supabase
        .from('batches')
        .select('name')
        .filter('name', 'ilike', `DXB-${productCode}-%`);
      
      if (error) throw error;
      
      // Generate the batch number starting from 00001
      const batchCount = (data?.length || 0) + 1;
      const batchNumber = `DXB-${productCode}-${batchCount.toString().padStart(5, '0')}`;
      
      return batchNumber;
    } catch (err) {
      console.error('Error generating batch number:', err);
      return `DXB-${getProductCode(productType)}-${new Date().getTime()}`; // Fallback using timestamp
    }
  };
  
  // Helper to get 2-letter product code
  const getProductCode = (productType: string): string => {
    switch (productType) {
      case "Flyers": return "FL";
      case "Postcards": return "PC";
      case "Posters": return "PO";
      case "Stickers": return "ST";
      case "Sleeves": return "SL";
      case "Boxes": return "BX";
      case "Covers": return "CV";
      default: return "XX";
    }
  };
  
  // Get batches for this product type
  const getBatches = async () => {
    if (!user) return [];
    
    try {
      const productCode = getProductCode(config.productType);
      
      const { data, error } = await supabase
        .from('batches')
        .select('*')
        .eq('created_by', user.id)
        .filter('name', 'ilike', `DXB-${productCode}-%`)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data as BaseBatch[];
    } catch (error) {
      console.error(`Error fetching ${config.productType} batches:`, error);
      return [];
    }
  };
  
  // Delete a batch and reset its jobs
  const deleteBatch = async (batchId: string) => {
    if (!user) return false;
    
    try {
      // First, reset all jobs in this batch back to queued status
      const { error: resetError } = await supabase
        .from(config.tableName)
        .update({ 
          status: 'queued',
          batch_id: null
        })
        .eq('batch_id', batchId);
      
      if (resetError) throw resetError;
      
      // Now delete the batch
      const { error } = await supabase
        .from('batches')
        .delete()
        .eq('id', batchId)
        .eq('created_by', user.id);
      
      if (error) throw error;
      
      toast.success("Batch deleted successfully");
      return true;
    } catch (error) {
      console.error(`Error deleting ${config.productType} batch:`, error);
      toast.error("Failed to delete batch");
      return false;
    }
  };

  return {
    createBatchWithSelectedJobs,
    isCreatingBatch,
    getBatches,
    deleteBatch
  };
}
