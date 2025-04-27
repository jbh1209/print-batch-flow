
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
import { BatchStatus } from "./types/BatchTypes";

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

      toast.success(`Batch marked as ${newStatus.replace('_', ' ')}`);
      onStatusUpdate();
    } catch (error) {
      console.error('Error updating batch status:', error);
      toast.error('Failed to update batch status');
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
