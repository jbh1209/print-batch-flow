
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BaseJob, ProductConfig } from "@/config/productTypes";

export function useBatchCreation(productType: string, tableName: string) {
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

  const createBatchWithSelectedJobs = async (
    selectedJobs: string[],
    config: ProductConfig
  ) => {
    if (selectedJobs.length === 0) return;
    
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

      // Create new batch with SLA target days from config
      const { data: batch, error: batchError } = await supabase
        .from('batches')
        .insert({
          name: batchName,
          status: 'pending',
          sheets_required: selectedJobs.length,
          sla_target_days: config.slaTargetDays // Use SLA from config
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
