
import { useState } from "react";

interface FilterCounts {
  all: number;
  queued: number;
  batched: number;
  completed: number;
}

interface StatusFilterTabsProps {
  filterView: "all" | "queued" | "batched" | "completed";
  filterCounts: FilterCounts;
  onFilterChange: (filter: "all" | "queued" | "batched" | "completed") => void;
}

export const StatusFilterTabs = ({
  filterView,
  filterCounts,
  onFilterChange,
}: StatusFilterTabsProps) => {
  return (
    <div className="border-b">
      <div className="flex">
        <button
          className={`px-4 py-2 text-sm font-medium ${
            filterView === 'all' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'
          }`}
          onClick={() => onFilterChange('all')}
        >
          All ({filterCounts.all})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            filterView === 'queued' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'
          }`}
          onClick={() => onFilterChange('queued')}
        >
          Queued ({filterCounts.queued})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            filterView === 'batched' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'
          }`}
          onClick={() => onFilterChange('batched')}
        >
          Batched ({filterCounts.batched})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            filterView === 'completed' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'
          }`}
          onClick={() => onFilterChange('completed')}
        >
          Completed ({filterCounts.completed})
        </button>
      </div>
    </div>
  );
};
