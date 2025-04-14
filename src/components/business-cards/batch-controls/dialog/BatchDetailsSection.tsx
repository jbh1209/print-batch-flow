
import { AlertCircle } from "lucide-react";
import { Job } from "../../JobsTable";
import { BatchOptimization } from "@/utils/batchOptimizationHelpers";

interface BatchDetailsSectionProps {
  selectedJobs: Job[];
  batchName: string;
  optimization: BatchOptimization | null;
  isCompatible: boolean;
}

const BatchDetailsSection = ({
  selectedJobs,
  batchName,
  optimization,
  isCompatible
}: BatchDetailsSectionProps) => {
  // Get job details for display
  const getJobDetails = () => {
    const laminationTypes = new Set(selectedJobs.map(job => job.lamination_type));
    const totalCards = selectedJobs.reduce((sum, job) => sum + job.quantity, 0);
    const sheetsRequired = optimization?.sheetsRequired || Math.ceil(totalCards / 24);
    
    return {
      totalJobs: selectedJobs.length,
      totalCards,
      sheetsRequired,
      laminationTypes: Array.from(laminationTypes)
    };
  };

  const jobDetails = getJobDetails();

  return (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <div className="flex items-center">
          <div className="font-medium">Batch Name:</div>
          <div className="ml-2 text-muted-foreground">{batchName}</div>
        </div>
        <p className="text-xs text-muted-foreground">
          Auto-generated batch ID following standard format
        </p>
      </div>
      
      <div className="space-y-1 rounded-md bg-muted p-3 text-sm">
        <div className="font-medium">Batch Details</div>
        <div className="text-muted-foreground">Total Jobs: {jobDetails.totalJobs}</div>
        <div className="text-muted-foreground">Total Cards: {jobDetails.totalCards}</div>
        <div className="text-muted-foreground">Sheets Required: {jobDetails.sheetsRequired}</div>
        <div className="text-muted-foreground">
          Lamination: {jobDetails.laminationTypes.map(t => 
            t === 'none' ? 'None' : t.charAt(0).toUpperCase() + t.slice(1)
          ).join(', ')}
        </div>
        
        {optimization && (
          <div className="mt-2 border-t pt-2 border-border/30">
            <div className="font-medium">Job Distribution</div>
            <div className="max-h-32 overflow-auto">
              {optimization.distribution.map((item, i) => (
                <div key={i} className="flex justify-between text-xs py-0.5">
                  <span className="truncate max-w-[150px]" title={item.job.name}>{item.job.name}</span>
                  <span className="text-muted-foreground">
                    {item.slotsNeeded} {item.slotsNeeded === 1 ? 'slot' : 'slots'}
                    {item.job.quantity > 0 && ` (${item.quantityPerSlot}/slot)`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {!isCompatible && (
          <div className="mt-2 flex items-center text-red-500 gap-1">
            <AlertCircle className="h-4 w-4" />
            <span>Warning: Jobs have different lamination types</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchDetailsSection;
