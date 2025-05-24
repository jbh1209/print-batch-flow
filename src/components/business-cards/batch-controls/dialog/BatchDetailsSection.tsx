
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
    <div className="space-y-3 sm:space-y-4">
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0">
          <div className="font-medium text-sm sm:text-base">Batch Name:</div>
          <div className="sm:ml-2 text-muted-foreground text-sm break-all">{batchName}</div>
        </div>
        <p className="text-xs text-muted-foreground">
          Auto-generated batch ID following standard format
        </p>
      </div>
      
      <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
        <div className="font-medium">Batch Details</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-muted-foreground text-xs sm:text-sm">
          <div>Total Jobs: {jobDetails.totalJobs}</div>
          <div>Total Cards: {jobDetails.totalCards}</div>
          <div>Sheets Required: {jobDetails.sheetsRequired}</div>
          <div className="sm:col-span-2">
            Lamination: {jobDetails.laminationTypes.map(t => 
              t === 'none' ? 'None' : t.charAt(0).toUpperCase() + t.slice(1)
            ).join(', ')}
          </div>
        </div>
        
        {optimization && (
          <div className="mt-2 border-t pt-2 border-border/30">
            <div className="font-medium text-sm">Job Distribution</div>
            <div className="max-h-24 sm:max-h-32 overflow-auto mt-1">
              {optimization.distribution.map((item, i) => (
                <div key={i} className="flex justify-between text-xs py-0.5">
                  <span className="truncate max-w-[120px] sm:max-w-[200px]" title={item.job.name}>
                    {item.job.name}
                  </span>
                  <span className="text-muted-foreground ml-2 flex-shrink-0">
                    {item.slotsNeeded} {item.slotsNeeded === 1 ? 'slot' : 'slots'}
                    {item.job.quantity > 0 && ` (${item.quantityPerSlot}/slot)`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {!isCompatible && (
          <div className="mt-2 flex items-center text-red-500 gap-1 text-xs sm:text-sm">
            <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            <span>Warning: Jobs have different lamination types</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchDetailsSection;
