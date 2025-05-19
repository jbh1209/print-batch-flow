
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

interface BatchDialogFooterProps {
  onClose: () => void;
  onCreateBatch: () => void;
  isCreatingBatch: boolean;
  isCreateDisabled: boolean;
}

export const BatchDialogFooter = ({
  onClose,
  onCreateBatch,
  isCreatingBatch,
  isCreateDisabled,
}: BatchDialogFooterProps) => {
  return (
    <DialogFooter className="gap-2 sm:gap-0">
      <Button variant="outline" onClick={onClose}>
        Cancel
      </Button>
      <Button 
        onClick={onCreateBatch} 
        disabled={isCreateDisabled || isCreatingBatch}
      >
        {isCreatingBatch ? "Creating Batch..." : "Create Batch"}
      </Button>
    </DialogFooter>
  );
};
