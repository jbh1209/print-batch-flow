
import React from 'react';
import { StandardDeleteBatchDialog } from "@/components/batches/StandardDeleteBatchDialog";

interface BatchDeleteConfirmationProps {
  batchToDelete: string | null;
  isDeleting: boolean;
  onCancel: () => void;
  onDelete: () => Promise<void>;
  batchName?: string;
}

export const BatchDeleteConfirmation: React.FC<BatchDeleteConfirmationProps> = ({
  batchToDelete,
  isDeleting,
  onCancel,
  onDelete,
  batchName
}) => {
  const handleConfirm = async () => {
    await onDelete();
  };

  return (
    <StandardDeleteBatchDialog
      isOpen={!!batchToDelete}
      isDeleting={isDeleting}
      batchName={batchName}
      onCancel={onCancel}
      onConfirm={handleConfirm}
    />
  );
};
