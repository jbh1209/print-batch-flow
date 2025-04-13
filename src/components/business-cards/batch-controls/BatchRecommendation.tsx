
import { Info } from "lucide-react";

interface BatchRecommendationProps {
  showBatchRecommendation: boolean;
  minRecommendedJobs: number;
}

const BatchRecommendation = ({ 
  showBatchRecommendation, 
  minRecommendedJobs 
}: BatchRecommendationProps) => {
  if (!showBatchRecommendation) {
    return null;
  }
  
  return (
    <div className="text-xs bg-amber-50 border border-amber-200 p-2 rounded-md text-amber-800 flex items-center gap-2 mb-2">
      <Info size={14} />
      <span>
        <strong>Recommendation:</strong> Select at least {minRecommendedJobs} jobs to create an efficient batch.
      </span>
    </div>
  );
};

export default BatchRecommendation;
