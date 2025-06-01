
import React from "react";

interface CategoryInfoBannerProps {
  jobsWithoutCategoryCount: number;
}

export const CategoryInfoBanner: React.FC<CategoryInfoBannerProps> = ({
  jobsWithoutCategoryCount
}) => {
  if (jobsWithoutCategoryCount === 0) return null;

  return (
    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <p className="text-sm text-amber-700">
        <strong>{jobsWithoutCategoryCount} jobs</strong> need category assignment. 
        Once a category is assigned, the due date will be calculated automatically and workflow stages will start immediately.
      </p>
    </div>
  );
};
