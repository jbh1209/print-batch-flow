import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BaseJob, BaseBatch, ProductConfig, LaminationType, TableName, BatchStatus } from '@/config/productTypes';
import { isExistingTable, getSupabaseTable } from '@/utils/database/tableUtils';

export function useGenericBatch<T extends BaseJob>(config: ProductConfig) {
  const { user } = useAuth();
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

  // Helper function to calculate sheets required based on job type
  const calculateSheetsRequired = (jobs: T[]): number => {
    let totalSheets = 0;
    
    for (const job of jobs) {
      let sheetsPerJob = 0;
      
      // Calculate differently based on product type
      if (config.productType === "Flyers") {
        // Use existing flyer calculation logic
        const jobSize = job.size;
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
      case "Business Cards": return "BC";
      default: return "XX";
    }
  };

  // Generate a batch number with format DXB-XX-00001 specific to product type
  const generateBatchNumber = async (productType: string): Promise<string> => {
    try {
      // Get product code for batch prefix
      const productCode = getProductCode(productType);
      
      // Get the count of existing batches for this product type
      const { data, error } = await supabase
        .from("batches")
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

  // Create a batch with selected jobs - avoid complex generic types
  const createBatchWithSelectedJobs = async (
    selectedJobs: T[], 
    batchProperties: {
      paperType?: string;
      paperWeight?: string;
      laminationType?: LaminationType;
      printerType?: string;
      sheetSize?: string;
    }
  ): Promise<BaseBatch> => {
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
      
      // Explicitly define batch status to avoid string assignment issues
      const batchStatus: BatchStatus = "pending";
      
      // Explicitly define batch insert data without complex type parameters
      const batchInsertData = {
        name: batchNumber,
        paper_type: batchProperties.paperType || null,
        paper_weight: batchProperties.paperWeight || null,
        lamination_type: laminationType,
        due_date: new Date().toISOString(), // Default to current date
        printer_type: batchProperties.printerType || "HP 12000",
        sheet_size: batchProperties.sheetSize || "530x750mm",
        sheets_required: sheetsRequired,
        created_by: user.id,
        status: batchStatus,
        front_pdf_url: null,
        back_pdf_url: null
      };
      
      // Use explicit response typing instead of complex generics
      const { data, error } = await supabase
        .from("batches")
        .insert(batchInsertData)
        .select()
        .single();
        
      if (error) throw error;
      
      if (!data) {
        throw new Error('No data returned from batch creation');
      }
      
      // Update all selected jobs to be part of this batch
      const jobIds = selectedJobs.map(job => job.id);
      
      const tableName = config.tableName;
      
      // Handle database tables that don't exist yet
      if (isExistingTable(tableName)) {
        // Get the valid table name
        const table = getSupabaseTable(tableName);
        
        // Execute update with simple typing
        const { error: updateError } = await supabase
          .from(table)
          .update({ 
            batch_id: data.id,
            status: 'batched' 
          })
          .in('id', jobIds);
        
        if (updateError) throw updateError;
      } else {
        console.log(`Table ${tableName} doesn't exist yet, skipping job updates`);
      }
      
      toast.success(`Batch ${batchNumber} created with ${selectedJobs.length} jobs`);
      
      // Explicitly define the returned batch object with proper types
      const batch: BaseBatch = {
        id: data.id,
        name: data.name,
        status: data.status,
        sheets_required: data.sheets_required,
        front_pdf_url: data.front_pdf_url || null,
        back_pdf_url: data.back_pdf_url || null,
        overview_pdf_url: null, // Add this virtual property
        due_date: data.due_date,
        created_at: data.created_at,
        created_by: data.created_by,
        lamination_type: data.lamination_type || "none",
        paper_type: data.paper_type,
        paper_weight: data.paper_weight,
        updated_at: data.updated_at
      };
      
      return batch;
      
    } catch (err) {
      console.error(`Error creating ${config.productType} batch:`, err);
      toast.error('Failed to create batch');
      throw err;
    } finally {
      setIsCreatingBatch(false);
    }
  };
  
  // Get batches for this product type
  const getBatches = async (): Promise<BaseBatch[]> => {
    if (!user) return [];
    
    try {
      const productCode = getProductCode(config.productType);
      
      // Use simpler typing for database queries
      const { data, error } = await supabase
        .from("batches")
        .select('*')
        .eq('created_by', user.id)
        .filter('name', 'ilike', `DXB-${productCode}-%`)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Use simple array checks without complex generic types
      if (!data) return [];
      
      // Map the data to the BaseBatch type without complex type inference
      return data.map(batch => ({
        id: batch.id,
        name: batch.name,
        status: batch.status,
        sheets_required: batch.sheets_required,
        front_pdf_url: batch.front_pdf_url || null,
        back_pdf_url: batch.back_pdf_url || null,
        overview_pdf_url: null, // Add this virtual property since it doesn't exist in DB
        due_date: batch.due_date,
        created_at: batch.created_at,
        created_by: batch.created_by,
        lamination_type: batch.lamination_type || "none",
        paper_type: batch.paper_type,
        paper_weight: batch.paper_weight,
        updated_at: batch.updated_at
      })) as BaseBatch[];
    } catch (error) {
      console.error(`Error fetching ${config.productType} batches:`, error);
      return [];
    }
  };
  
  // Delete a batch and reset its jobs
  const deleteBatch = async (batchId: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const tableName = config.tableName;
      
      if (isExistingTable(tableName)) {
        // Get the valid table name
        const table = getSupabaseTable(tableName);
        
        // Use simple query without complex generic types
        const { error: resetError } = await supabase
          .from(table)
          .update({ 
            status: 'queued',
            batch_id: null
          })
          .eq('batch_id', batchId);
        
        if (resetError) throw resetError;
      }
      
      // Now delete the batch
      const { error: deleteError } = await supabase
        .from("batches")
        .delete()
        .eq('id', batchId)
        .eq('created_by', user.id);
      
      if (deleteError) throw deleteError;
      
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
