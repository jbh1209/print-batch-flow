
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteBatchDialogProps {
  isOpen: boolean;
  isDeleting: boolean;
  batchName?: string;
  onClose: () => void;
  onConfirmDelete: () => void;
}

const DeleteBatchDialog = ({ 
  isOpen, 
  isDeleting, 
  batchName = "",
  onClose, 
  onConfirmDelete 
}: DeleteBatchDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Batch{batchName ? ` - ${batchName}` : ""}</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this batch? This will return all jobs to the queue.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">This action cannot be undone.</p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive"
            onClick={onConfirmDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Batch'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteBatchDialog;
