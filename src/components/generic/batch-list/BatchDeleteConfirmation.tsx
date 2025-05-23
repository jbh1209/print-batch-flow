
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
import { Loader2 } from "lucide-react";
import { useBatchOperations } from '@/context/BatchOperationsContext';

interface BatchDeleteConfirmationProps {
  batchToDelete: string | null;
  onCancel: () => void;
  onDelete: () => Promise<void>;
  batchName?: string;
}

export const BatchDeleteConfirmation: React.FC<BatchDeleteConfirmationProps> = ({
  batchToDelete,
  onCancel,
  onDelete,
  batchName
}) => {
  const { isDeletingBatch } = useBatchOperations();

  return (
    <AlertDialog open={!!batchToDelete} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {batchName 
              ? `Are you sure you want to delete batch ${batchName}?` 
              : "Are you sure you want to delete this batch?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will return all jobs in this batch to the queue.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeletingBatch}>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onDelete} 
            disabled={isDeletingBatch}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {isDeletingBatch ? (
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
