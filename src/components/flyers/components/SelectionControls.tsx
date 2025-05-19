
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface SelectionControlsProps {
  selectedCount: number;
  totalSelectableCount: number;
  onCreateBatch: () => void;
  isCreatingBatch?: boolean;
}

export const SelectionControls = ({
  selectedCount,
  totalSelectableCount,
  onCreateBatch,
  isCreatingBatch = false,
}: SelectionControlsProps) => {
  const batchButtonDisabled = selectedCount === 0 || isCreatingBatch;
  
  return (
    <div className="flex justify-between items-center p-4 border-b">
      <div className="text-sm text-muted-foreground">
        {selectedCount} of {totalSelectableCount} jobs selected
      </div>
      <Button 
        onClick={onCreateBatch} 
        disabled={batchButtonDisabled}
      >
        {isCreatingBatch ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating Batch...
          </>
        ) : (
          "Create Batch"
        )}
      </Button>
    </div>
  );
};
