
import React from "react";
import { ColumnFilters } from "../ColumnFilters";
import { Card } from "@/components/ui/card";

interface JobTableFiltersProps {
  showColumnFilters: boolean;
  columnFilters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
  availableCategories: Array<{ value: string; label: string }>;
  availableStatuses: Array<{ value: string; label: string }>;
  availableStages: Array<{ value: string; label: string }>;
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
