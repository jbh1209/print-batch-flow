
import { Button } from "@/components/ui/button";

interface SelectionControlsProps {
  selectedCount: number;
  totalSelectableCount: number;
  onCreateBatch: () => void;
}

export const SelectionControls = ({
  selectedCount,
  totalSelectableCount,
  onCreateBatch,
}: SelectionControlsProps) => {
  const batchButtonDisabled = selectedCount === 0;
  
  return (
    <div className="flex justify-between items-center p-4 border-b">
      <div className="text-sm text-muted-foreground">
        {selectedCount} of {totalSelectableCount} jobs selected
      </div>
      <Button 
        onClick={onCreateBatch} 
        disabled={batchButtonDisabled}
      >
        Create Batch
      </Button>
    </div>
  );
};
