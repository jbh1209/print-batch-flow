
import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface ColumnFiltersProps {
  filters: {
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

export const ColumnFilters: React.FC<ColumnFiltersProps> = ({
  filters,
  onFilterChange,
  onClearFilters,
  availableCategories,
  availableStatuses,
  availableStages
}) => {
  const activeFiltersCount = Object.values(filters).filter(value => value !== '').length;

  return (
    <div className="space-y-4 p-4 bg-gray-50 border-b">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Column Filters</h3>
        {activeFiltersCount > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''} active
            </Badge>
            <button
              onClick={onClearFilters}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">WO Number</label>
          <Input
            placeholder="Filter by WO..."
            value={filters.woNumber}
            onChange={(e) => onFilterChange('woNumber', e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Customer</label>
          <Input
            placeholder="Filter by customer..."
            value={filters.customer}
            onChange={(e) => onFilterChange('customer', e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Reference</label>
          <Input
            placeholder="Filter by reference..."
            value={filters.reference}
            onChange={(e) => onFilterChange('reference', e.target.value)}
            className="h-8 text-xs"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Category</label>
          <Select
            value={filters.category}
            onValueChange={(value) => onFilterChange('category', value)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All categories</SelectItem>
              {availableCategories.map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Status</label>
          <Select
            value={filters.status}
            onValueChange={(value) => onFilterChange('status', value)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All statuses</SelectItem>
              {availableStatuses.map(status => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Due Date</label>
          <Select
            value={filters.dueDate}
            onValueChange={(value) => onFilterChange('dueDate', value)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All dates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All dates</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="today">Due today</SelectItem>
              <SelectItem value="thisWeek">Due this week</SelectItem>
              <SelectItem value="nextWeek">Due next week</SelectItem>
              <SelectItem value="noDate">No date set</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Current Stage</label>
          <Select
            value={filters.currentStage}
            onValueChange={(value) => onFilterChange('currentStage', value)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All stages</SelectItem>
              {availableStages.map(stage => (
                <SelectItem key={stage} value={stage}>
                  {stage}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
