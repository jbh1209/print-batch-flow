
import React from "react";
import { FileQuestion } from "lucide-react";

interface FlyerJobsEmptyStateProps {
  productType: string;
}

export const FlyerJobsEmptyState: React.FC<FlyerJobsEmptyStateProps> = ({ productType }) => {
  return (
    <div className="text-center py-12">
      <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <FileQuestion className="h-6 w-6 text-gray-400" />
      </div>
      <h3 className="font-medium text-lg mb-2">No {productType} Jobs Yet</h3>
      <p className="text-gray-500 max-w-md mx-auto">
        You haven't created any {productType.toLowerCase()} jobs yet. 
        Create your first job to get started.
      </p>
    </div>
  );
};
