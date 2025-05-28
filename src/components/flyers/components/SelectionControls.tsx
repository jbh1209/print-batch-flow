
import { Button } from "@/components/ui/button";

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
  isCreatingBatch = false
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
        {isCreatingBatch ? "Creating Batch..." : "Create Batch"}
      </Button>
    </div>
  );
};
