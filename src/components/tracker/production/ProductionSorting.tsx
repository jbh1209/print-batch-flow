
import React from "react";
import { Button } from "@/components/ui/button";

interface ProductionSortingProps {
  sortBy: 'wo_no' | 'due_date';
  sortOrder: 'asc' | 'desc';
  onSort: (field: 'wo_no' | 'due_date') => void;
}

export const ProductionSorting: React.FC<ProductionSortingProps> = ({
  sortBy,
  sortOrder,
  onSort
}) => {
  return (
    <div className="mb-4 flex gap-2">
      <Button
        variant={sortBy === 'wo_no' ? "default" : "outline"}
        size="sm"
        onClick={() => onSort('wo_no')}
      >
        Sort by Job Number {sortBy === 'wo_no' && (sortOrder === 'asc' ? '↑' : '↓')}
      </Button>
      <Button
        variant={sortBy === 'due_date' ? "default" : "outline"}
        size="sm"
        onClick={() => onSort('due_date')}
      >
        Sort by Date Required {sortBy === 'due_date' && (sortOrder === 'asc' ? '↑' : '↓')}
      </Button>
    </div>
  );
};
