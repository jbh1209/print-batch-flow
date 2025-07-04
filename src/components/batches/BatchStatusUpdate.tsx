
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
      // Get batch job references to understand constituent jobs
      const { data: batchRefs, error: refsError } = await supabase
        .from('batch_job_references')
        .select('production_job_id')
        .eq('batch_id', batchId);

      if (refsError) throw refsError;

      if (!batchRefs || batchRefs.length === 0) {
        throw new Error('No constituent jobs found for batch');
      }

      // Use the new database function to create proper batch master job
      const constituentJobIds = batchRefs.map(ref => ref.production_job_id);
      
      const { data: masterJobId, error: createError } = await supabase
        .rpc('create_batch_master_job', {
          p_batch_id: batchId,
          p_constituent_job_ids: constituentJobIds
        });

      if (createError) throw createError;

      console.log('✅ Batch master job created with proper WO number preservation:', masterJobId);
    } catch (error) {
      console.error('❌ Error creating batch master job:', error);
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
