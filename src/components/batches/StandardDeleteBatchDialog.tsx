
import React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction
} from "@/components/ui/alert-dialog";
import { Loader2, AlertCircle } from "lucide-react";

interface StandardDeleteBatchDialogProps {
  isOpen: boolean;
  isDeleting: boolean;
  batchName?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const StandardDeleteBatchDialog: React.FC<StandardDeleteBatchDialogProps> = ({
  isOpen,
  isDeleting,
  batchName,
  onCancel,
  onConfirm
}) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            Delete Batch{batchName ? ` - ${batchName}` : ""}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this batch? This action will:
            <ul className="mt-2 list-disc list-inside space-y-1 text-sm">
              <li>Permanently remove the batch</li>
              <li>Return all jobs in this batch to the queue</li>
              <li>Cannot be undone</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p className="text-sm">This action cannot be undone.</p>
        </div>
        
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm} 
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Batch'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
