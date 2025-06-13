
import React from "react";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CategoryAssignModalHeaderProps {
  currentStep: 'category' | 'parts';
  job: any;
}

export const CategoryAssignModalHeader: React.FC<CategoryAssignModalHeaderProps> = ({
  currentStep,
  job
}) => {
  return (
    <DialogHeader>
      <DialogTitle>
        {currentStep === 'category' ? 'Assign Category' : 'Assign Parts to Stages'}
        {job.isMultiple ? ` (${job.selectedIds?.length || 0} jobs)` : ` - ${job.wo_no || 'Unknown'}`}
      </DialogTitle>
    </DialogHeader>
  );
};
