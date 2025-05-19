
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

interface ProductPageJobsEmptyStateProps {
  onCreateJob: () => void;
}

export function ProductPageJobsEmptyState({ onCreateJob }: ProductPageJobsEmptyStateProps) {
  return (
    <div className="bg-white rounded-lg border shadow p-8 flex flex-col items-center justify-center min-h-[400px]">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">No jobs found</h2>
        <p className="text-gray-500 mb-6">
          Start by creating a new product page job
        </p>
        <Button onClick={onCreateJob}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Create Your First Job
        </Button>
      </div>
    </div>
  );
}
