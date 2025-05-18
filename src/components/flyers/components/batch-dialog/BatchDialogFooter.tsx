
import React from 'react';
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

interface BatchDialogFooterProps {
  onClose: () => void;
  onCreateBatch: () => void;
  isCreatingBatch: boolean;
  isCreateDisabled: boolean;
}

export const BatchDialogFooter: React.FC<BatchDialogFooterProps> = ({
  onClose,
  onCreateBatch,
  isCreatingBatch,
  isCreateDisabled
}) => {
  return (
    <DialogFooter className="pt-4 border-t mt-4">
      <Button variant="outline" onClick={onClose} disabled={isCreatingBatch}>
        Cancel
      </Button>
      <Button 
        onClick={onCreateBatch} 
        disabled={isCreateDisabled || isCreatingBatch}
      >
        {isCreatingBatch ? "Creating..." : "Create Batch"}
      </Button>
    </DialogFooter>
  );
};
