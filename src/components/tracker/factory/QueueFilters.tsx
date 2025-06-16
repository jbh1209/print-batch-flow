
import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw } from "lucide-react";
import { ViewToggle } from "../common/ViewToggle";
import { QueueToggleControls } from "./QueueToggleControls";

interface QueueFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: 'card' | 'list';
  onViewModeChange: (mode: 'card' | 'list') => void;
  onQueueFiltersChange: (filters: string[]) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  showQueueControls: boolean;
  totalJobs: number;
  jobGroupsCount: number;
}

export const QueueFilters: React.FC<QueueFiltersProps> = ({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onQueueFiltersChange,
  onRefresh,
  isRefreshing,
  showQueueControls,
  totalJobs,
  jobGroupsCount
}) => {
  return (
    <div className="flex-shrink-0 p-4 bg-white border-b space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search jobs by WO, customer, reference..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <ViewToggle view={viewMode} onViewChange={onViewModeChange} />

          {/* Queue Toggle Controls - only show for print operators */}
          {showQueueControls && (
            <div className="relative">
              <QueueToggleControls 
                onQueueFiltersChange={onQueueFiltersChange}
              />
            </div>
          )}

          {/* Refresh Button */}
          <Button
            variant="outline"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Job Count with Master Queue Info */}
      <div className="text-sm text-gray-600">
        {totalJobs} job{totalJobs !== 1 ? 's' : ''} available across {jobGroupsCount} queue{jobGroupsCount !== 1 ? 's' : ''}
        {searchQuery && ` (filtered)`}
      </div>
    </div>
  );
};
