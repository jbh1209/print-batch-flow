
import React from "react";
import { Card } from "@/components/ui/card";
import { ColumnFilters } from "../ColumnFilters";

interface EnhancedTableFiltersProps {
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

export const EnhancedTableFilters: React.FC<EnhancedTableFiltersProps> = ({
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
