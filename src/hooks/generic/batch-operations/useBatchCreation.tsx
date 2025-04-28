
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { BaseJob, LaminationType, TableName } from "@/config/productTypes";
import { toast } from "sonner";
import { isExistingTable } from "@/utils/database/tableUtils";

interface BatchProperties {
  paperType?: string;
  paperWeight?: string;
  laminationType?: LaminationType;
  printerType?: string;
  sheetSize?: string;
}

export function useBatchCreation(productType: string, tableName: TableName) {
  const { user } = useAuth();
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

  const calculateSheetsRequired = (jobs: BaseJob[]): number => {
    let totalSheets = 0;
    
    for (const job of jobs) {
      let sheetsPerJob = 0;
      
      if ('size' in job && typeof job.size === 'string') {
        switch (job.size) {
          case 'A5': sheetsPerJob = Math.ceil(job.quantity / 2); break;
          case 'A4': sheetsPerJob = job.quantity; break;
          case 'DL': sheetsPerJob = Math.ceil(job.quantity / 3); break;
          case 'A3': sheetsPerJob = job.quantity * 1.5; break;
          default: sheetsPerJob = job.quantity;
        }
      } else {
        sheetsPerJob = job.quantity;
      }
      
      totalSheets += sheetsPerJob;
    }
    
    return Math.ceil(totalSheets * 1.1); // 10% extra
  };

  const generateBatchNumber = async (prefix: string): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from('batches')
        .select('name')
        .filter('name', 'ilike', `${prefix}%`);
      
      if (error) throw error;
      
      const batchCount = (data?.length || 0) + 1;
      return `${prefix}${batchCount.toString().padStart(5, '0')}`;
    } catch (err) {
      console.error('Error generating batch number:', err);
      return `${prefix}${new Date().getTime()}`; // Fallback using timestamp
    }
  };

  const createBatchWithSelectedJobs = async <T extends BaseJob>(
    selectedJobs: T[],
    batchProperties: BatchProperties
  ) => {
    if (!user) throw new Error('User not authenticated');
    if (selectedJobs.length === 0) throw new Error('No jobs selected');

    try {
      setIsCreatingBatch(true);
      const sheetsRequired = calculateSheetsRequired(selectedJobs);
      const productPrefix = productType === "Sleeves" ? "DXB-SL-" : 
                          productType === "Flyers" ? "DXB-FL-" : 
                          productType === "Business Cards" ? "DXB-BC-" : "DXB-";
      
      const batchNumber = await generateBatchNumber(productPrefix);
      
      const { data: batchData, error: batchError } = await supabase
        .from('batches')
        .insert({
          name: batchNumber,
          paper_type: batchProperties.paperType,
          paper_weight: batchProperties.paperWeight,
          lamination_type: batchProperties.laminationType || "none",
          due_date: new Date().toISOString(),
          printer_type: batchProperties.printerType || "HP 12000",
          sheet_size: batchProperties.sheetSize || "530x750mm",
          sheets_required: sheetsRequired,
          created_by: user.id,
          status: 'pending'
        })
        .select()
        .single();
        
      if (batchError) throw batchError;
      
      if (!isExistingTable(tableName)) {
        throw new Error(`Table ${tableName} doesn't exist yet, cannot update jobs`);
      }
      
      const jobIds = selectedJobs.map(job => job.id);
      const { error: updateError } = await supabase
        .from(tableName as any)
        .update({ 
          batch_id: batchData.id,
          status: 'batched' 
        })
        .in('id', jobIds);
      
      if (updateError) throw updateError;
      
      toast.success(`Batch ${batchNumber} created with ${selectedJobs.length} jobs`);
      return batchData;
      
    } catch (err) {
      console.error('Error creating batch:', err);
      toast.error('Failed to create batch');
      throw err;
    } finally {
      setIsCreatingBatch(false);
    }
  };

  return { createBatchWithSelectedJobs, isCreatingBatch };
}
