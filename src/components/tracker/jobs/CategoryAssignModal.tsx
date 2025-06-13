
import React from "react";
import { SimpleCategoryAssignModal } from "./SimpleCategoryAssignModal";

interface CategoryAssignModalProps {
  job: any;
  categories: any[];
  onClose: () => void;
  onAssign: () => void;
}

export const CategoryAssignModal: React.FC<CategoryAssignModalProps> = ({
  job,
  categories,
  onClose,
  onAssign
}) => {
  // Use the simplified modal instead of the complex one
  return (
    <SimpleCategoryAssignModal
      job={job}
      onClose={onClose}
      onAssign={onAssign}
    />
  );
};
