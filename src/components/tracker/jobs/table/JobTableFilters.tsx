
import React from "react";
import { ColumnFilters } from "../ColumnFilters";
import { Card } from "@/components/ui/card";

interface JobTableFiltersProps {
  showColumnFilters: boolean;
  columnFilters: {
    woNumber: string;
    customer: string;
    reference: string;
    category: string;
    status: string;
    dueDate: string;
    currentStage: string;
  };
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
  availableCategories: string[];
  availableStatuses: string[];
  availableStages: string[];
}

export const JobTableFilters: React.FC<JobTableFiltersProps> = ({
  showColumnFilters,
  columnFilters,
  onFilterChange,
  onClearFilters,
  availableCategories,
  availableStatuses,
  availableStages
}) => {
  if (!showColumnFilters) return null;

  return (
    <Card>
      <ColumnFilters
        filters={columnFilters}
        onFilterChange={onFilterChange}
        onClearFilters={onClearFilters}
        availableCategories={availableCategories}
        availableStatuses={availableStatuses}
        availableStages={availableStages}
      />
    </Card>
  );
};
