
import React from "react";
import { Button } from "@/components/ui/button";

interface ProductionSortingProps {
  sortBy: 'wo_no' | 'due_date' | 'proof_approval';
  sortOrder: 'asc' | 'desc';
  onSort: (field: 'wo_no' | 'due_date' | 'proof_approval') => void;
  viewMode: 'list' | 'calendar';
  onViewModeChange: (mode: 'list' | 'calendar') => void;
}

export const ProductionSorting: React.FC<ProductionSortingProps> = ({
  sortBy,
  sortOrder,
  onSort,
  viewMode,
  onViewModeChange
}) => {
  return (
    <div className="mb-4 flex gap-2 items-center justify-between">
      <div className="flex gap-2">
        <Button
          variant={sortBy === 'wo_no' ? "default" : "outline"}
          size="sm"
          onClick={() => onSort('wo_no')}
        >
          Job Number {sortBy === 'wo_no' && (sortOrder === 'asc' ? '↑' : '↓')}
        </Button>
        <Button
          variant={sortBy === 'due_date' ? "default" : "outline"}
          size="sm"
          onClick={() => onSort('due_date')}
        >
          Due Date {sortBy === 'due_date' && (sortOrder === 'asc' ? '↑' : '↓')}
        </Button>
        <Button
          variant={sortBy === 'proof_approval' ? "default" : "outline"}
          size="sm"
          onClick={() => onSort('proof_approval')}
        >
          Proof Approval {sortBy === 'proof_approval' && (sortOrder === 'asc' ? '↑' : '↓')}
        </Button>
      </div>
      
      <div className="flex gap-2">
        <Button
          variant={viewMode === 'list' ? "default" : "outline"}
          size="sm"
          onClick={() => onViewModeChange('list')}
        >
          List View
        </Button>
        <Button
          variant={viewMode === 'calendar' ? "default" : "outline"}
          size="sm"
          onClick={() => onViewModeChange('calendar')}
        >
          Weekly Schedule
        </Button>
      </div>
    </div>
  );
};
