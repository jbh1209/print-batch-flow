
import { Button } from "@/components/ui/button";

interface BatchFixBannerProps {
  onFixJobs: () => void;
  isFixingBatchedJobs: boolean;
}

export const BatchFixBanner = ({ 
  onFixJobs, 
  isFixingBatchedJobs 
}: BatchFixBannerProps) => {
  return (
    <div className="border-t p-3 bg-amber-50 flex justify-between items-center">
      <div className="text-sm text-amber-800">
        <span className="font-medium">Note:</span> Some jobs may be stuck in "batched" status after a batch was deleted.
      </div>
      <Button 
        variant="outline" 
        size="sm"
        className="bg-white"
        onClick={onFixJobs}
        disabled={isFixingBatchedJobs}
      >
        {isFixingBatchedJobs ? (
          <>
            <div className="h-3 w-3 mr-2 rounded-full border-t-2 border-b-2 border-primary animate-spin"></div>
            Fixing...
          </>
        ) : (
          'Fix Orphaned Jobs'
        )}
      </Button>
    </div>
  );
};
