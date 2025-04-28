
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BaseJob, ProductConfig } from "@/config/productTypes";
import { useAuth } from "@/hooks/useAuth";

export function useBatchCreation(productType: string, tableName: string) {
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const { user } = useAuth();

  const createBatchWithSelectedJobs = async (
    selectedJobs: string[],
    config: ProductConfig
  ) => {
    if (selectedJobs.length === 0 || !user) return;
    
    setIsCreatingBatch(true);
    try {
      // Generate batch name based on product type
      const prefix = config.productType === "Business Cards" ? "DXB-BC-" :
                    config.productType === "Flyers" ? "DXB-FL-" :
                    config.productType === "Postcards" ? "DXB-PC-" :
                    config.productType === "Posters" ? "DXB-PO-" :
                    config.productType === "Stickers" ? "DXB-ST-" :
                    config.productType === "Sleeves" ? "DXB-SL-" :
                    config.productType === "Boxes" ? "DXB-BX-" :
                    "DXB-CO-";
                    
      const timestamp = new Date().getTime();
      const batchName = `${prefix}${timestamp}`;

      // Create new batch
      const { data: batch, error: batchError } = await supabase
        .from('batches')
        .insert({
          name: batchName,
          status: 'pending',
          sheets_required: selectedJobs.length,
          sla_target_days: config.slaTargetDays,
          created_by: user.id,
          due_date: new Date().toISOString(), // Set current date as default
          lamination_type: 'none'
        })
        .select()
        .single();

      if (batchError) throw batchError;

      // Update jobs with batch_id
      const { error: updateError } = await supabase
        .from(tableName)
        .update({ 
          batch_id: batch.id,
          status: 'batched'
        })
        .in('id', selectedJobs);

      if (updateError) throw updateError;

      toast.success('Batch created successfully');
      return batch;
    } catch (error) {
      console.error('Error creating batch:', error);
      toast.error('Failed to create batch');
    } finally {
      setIsCreatingBatch(false);
    }
  };

  return {
    createBatchWithSelectedJobs,
    isCreatingBatch
  };
}
