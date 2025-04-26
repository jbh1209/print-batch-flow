
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface BatchFixBannerProps {
  onFixJobs: () => Promise<number>;
  isFixingBatchedJobs: boolean;
}

export const BatchFixBanner = ({ onFixJobs, isFixingBatchedJobs }: BatchFixBannerProps) => {
  const handleFixClick = async () => {
    const fixedCount = await onFixJobs();
    // You can use the fixedCount here if needed
  };

  return (
    <div className="bg-amber-50 p-3 border-t border-b border-amber-200 flex justify-between items-center">
      <div className="flex items-center text-amber-800">
        <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
        <span className="text-sm">
          Some jobs are marked as batched but not assigned to a batch. This can happen if batch creation was interrupted.
        </span>
      </div>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleFixClick}
        disabled={isFixingBatchedJobs}
        className="ml-4 flex-shrink-0 bg-white"
      >
        {isFixingBatchedJobs ? "Fixing..." : "Fix Jobs"}
      </Button>
    </div>
  );
};
