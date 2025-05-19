
import { Button } from "@/components/ui/button";
import { LayersIcon, PlusCircle } from "lucide-react";

interface SelectionControlsProps {
  selectedCount: number;
  totalSelectableCount: number;
  onCreateBatch: () => void;
  onCreateJob: () => void;
}

export function SelectionControls({
  selectedCount,
  totalSelectableCount,
  onCreateBatch,
  onCreateJob
}: SelectionControlsProps) {
  return (
    <div className="p-4 border-b flex items-center justify-between">
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">
          {selectedCount > 0 ? (
            <>
              <span className="font-medium">{selectedCount}</span> jobs selected
            </>
          ) : (
            `${totalSelectableCount} jobs available for batching`
          )}
        </span>
        <Button
          variant="default"
          size="sm"
          onClick={onCreateBatch}
          disabled={selectedCount === 0}
        >
          <LayersIcon className="h-4 w-4 mr-2" />
          Create Batch ({selectedCount})
        </Button>
      </div>
      <Button variant="outline" size="sm" onClick={onCreateJob}>
        <PlusCircle className="h-4 w-4 mr-2" />
        Create Job
      </Button>
    </div>
  );
}
