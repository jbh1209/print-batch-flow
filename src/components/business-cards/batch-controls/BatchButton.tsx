
import { Button } from "@/components/ui/button";
import { FileCheck } from "lucide-react";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid } from "lucide-react";
import { BatchOptimization } from "@/utils/batchOptimizationHelpers";

interface BatchButtonProps {
  selectedJobsCount: number;
  isCompatible: boolean;
  onClick: () => void;
  optimization: BatchOptimization | null;
}

const BatchButton = ({ 
  selectedJobsCount, 
  isCompatible, 
  onClick, 
  optimization 
}: BatchButtonProps) => {
  // The button should only be disabled if no jobs are selected
  // Jobs with different lamination types will show as destructive but still be clickable
  const isDisabled = selectedJobsCount === 0;
  
  return (
    <div className="flex gap-2 items-center">
      <Button 
        onClick={onClick}
        disabled={isDisabled}
        variant={isCompatible ? "default" : "destructive"}
        className="flex gap-2"
      >
        {selectedJobsCount > 0 ? (
          <>
            <FileCheck className="h-4 w-4" />
            Batch {selectedJobsCount} Jobs
          </>
        ) : (
          "Create Batch"
        )}
      </Button>
      
      {optimization && selectedJobsCount > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-flex">
                <Badge variant="outline" className="flex gap-1 items-center">
                  <LayoutGrid className="h-3 w-3" />
                  {optimization.sheetsRequired} sheets ({Math.round(optimization.slotUtilization)}% utilization)
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Sheet utilization: {Math.round(optimization.slotUtilization)}%</p>
              <p>Slots: {optimization.distribution.reduce((sum, item) => sum + item.slotsNeeded, 0)}/24</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
};

export default BatchButton;
