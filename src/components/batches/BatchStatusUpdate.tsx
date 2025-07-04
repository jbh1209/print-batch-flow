
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { CheckCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BatchStatus } from "@/config/productTypes";

interface BatchStatusUpdateProps {
  batchId: string;
  currentStatus: BatchStatus;
  onStatusUpdate: () => void;
}

const BatchStatusUpdate = ({ batchId, currentStatus, onStatusUpdate }: BatchStatusUpdateProps) => {
  const updateBatchStatus = async (newStatus: BatchStatus) => {
    try {
      const { error } = await supabase
        .from('batches')
        .update({ status: newStatus })
        .eq('id', batchId);

      if (error) throw error;

      // If status is "sent_to_print", create batch production job
      if (newStatus === 'sent_to_print') {
        await createBatchProductionJob(batchId);
      }

      toast.success(`Batch marked as ${newStatus.replace('_', ' ')}`);
      onStatusUpdate();
    } catch (error) {
      console.error('Error updating batch status:', error);
      toast.error('Failed to update batch status');
    }
  };

  const createBatchProductionJob = async (batchId: string) => {
    try {
      // Get batch details
      const { data: batch, error: batchError } = await supabase
        .from('batches')
        .select('*')
        .eq('id', batchId)
        .single();

      if (batchError) throw batchError;

      // Get batch job references to understand constituent jobs
      const { data: batchRefs, error: refsError } = await supabase
        .from('batch_job_references')
        .select(`
          production_job_id,
          production_jobs (
            category_id,
            categories (
              id,
              name,
              color
            )
          )
        `)
        .eq('batch_id', batchId);

      if (refsError) throw refsError;

      // Determine batch category from constituent jobs
      const categories = batchRefs?.map(ref => ref.production_jobs?.categories).filter(Boolean) || [];
      const primaryCategory = categories[0];

      // Create batch production job
      const { data: batchJob, error: createError } = await supabase
        .from('production_jobs')
        .insert({
          wo_no: `BATCH-${batch.name}`,
          customer: `Batch: ${batch.name}`,
          reference: `Batch containing ${batchRefs?.length || 0} jobs`,
          status: 'In Production',
          category_id: primaryCategory?.id || null,
          batch_category: batch.name,
          user_id: batch.created_by,
          qty: batchRefs?.length || 0
        })
        .select()
        .single();

      if (createError) throw createError;

      // Initialize workflow stages for batch job if it has a category
      if (primaryCategory?.id && batchJob) {
        await supabase.rpc('initialize_job_stages_auto', {
          p_job_id: batchJob.id,
          p_job_table_name: 'production_jobs',
          p_category_id: primaryCategory.id
        });
      }

      console.log('✅ Batch production job created:', batchJob);
    } catch (error) {
      console.error('❌ Error creating batch production job:', error);
      throw error;
    }
  };

  // Don't show options for batches that are already completed or cancelled
  if (currentStatus === 'completed' || currentStatus === 'cancelled') {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Update Status</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem 
          onClick={() => updateBatchStatus('completed')}
          className="flex items-center gap-2"
        >
          <CheckCircle className="h-4 w-4" />
          Mark as Completed
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => updateBatchStatus('sent_to_print')}
          className="flex items-center gap-2"
        >
          <Printer className="h-4 w-4" />
          Send to Print
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default BatchStatusUpdate;
