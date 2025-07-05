
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

      // If status is "completed", trigger reverse sync to update production jobs
      if (newStatus === 'completed') {
        console.log('🔄 Batch marked as completed - triggering reverse sync to update production jobs');
        
        // The database trigger will handle the sync automatically, but we can also call it explicitly
        const { error: syncError } = await supabase.rpc('sync_production_jobs_from_batch_completion');
        
        if (syncError) {
          console.warn('⚠️ Reverse sync warning:', syncError);
          // Don't fail the entire operation for sync issues
        } else {
          console.log('✅ Production jobs sync completed successfully');
        }
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
      console.log('🔄 Creating batch production job for batch ID:', batchId);
      
      // Get batch job references to understand constituent jobs
      const { data: batchRefs, error: refsError } = await supabase
        .from('batch_job_references')
        .select('production_job_id')
        .eq('batch_id', batchId);

      if (refsError) {
        console.error('❌ Error fetching batch references:', refsError);
        throw new Error(`Failed to fetch batch references: ${refsError.message}`);
      }

      if (!batchRefs || batchRefs.length === 0) {
        console.error('❌ No constituent jobs found for batch:', batchId);
        throw new Error('No constituent jobs found for batch');
      }

      console.log('📋 Found constituent jobs:', batchRefs.length);

      // Use the new database function to create proper batch master job
      const constituentJobIds = batchRefs.map(ref => ref.production_job_id);
      
      console.log('🚀 Creating master job with constituent job IDs:', constituentJobIds);
      
      const { data: masterJobId, error: createError } = await supabase
        .rpc('create_batch_master_job', {
          p_batch_id: batchId,
          p_constituent_job_ids: constituentJobIds
        });

      if (createError) {
        console.error('❌ Database function error:', createError);
        throw new Error(`Failed to create batch master job: ${createError.message}`);
      }

      console.log('✅ Batch master job created successfully:', masterJobId);
      return masterJobId;
    } catch (error) {
      console.error('❌ Error creating batch master job:', error);
      // Re-throw with more context
      if (error instanceof Error) {
        throw new Error(`Send to Print failed: ${error.message}`);
      } else {
        throw new Error('Send to Print failed: Unknown error occurred');
      }
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
