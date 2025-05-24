
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Loader } from "lucide-react";

interface BatchDialogFooterProps {
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  isCreatingBatch: boolean;
}

const BatchDialogFooter = ({
  onCancel,
  onConfirm,
  isCreatingBatch
}: BatchDialogFooterProps) => {
  return (
    <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
      <Button 
        variant="outline" 
        onClick={onCancel}
        disabled={isCreatingBatch}
        className="w-full sm:w-auto"
      >
        Cancel
      </Button>
      <Button 
        onClick={onConfirm}
        disabled={isCreatingBatch}
        className="gap-2 w-full sm:w-auto"
      >
        {isCreatingBatch ? (
          <>
            <Loader className="h-4 w-4 animate-spin" />
            Creating...
          </>
        ) : (
          "Create Batch"
        )}
      </Button>
    </DialogFooter>
  );
};

export default BatchDialogFooter;
