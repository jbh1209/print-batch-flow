import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, SortAsc, SortDesc, LayoutGrid, LayoutList } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CompactJobCard } from "./CompactJobCard";
import { ViewToggle } from "../common/ViewToggle";
import { JobListView } from "../common/JobListView";

interface EnhancedJobsListProps {
  jobs: any[];
  selectedStage?: string;
  isLoading?: boolean;
  onStageAction?: (jobId: string, stageId: string, action: 'start' | 'complete' | 'qr-scan') => void;
}

export const EnhancedJobsList: React.FC<EnhancedJobsListProps> = ({
  jobs,
  selectedStage,
  isLoading,
  onStageAction
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<'due_date' | 'wo_no' | 'customer' | 'status'>('due_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  // Filter and sort jobs
  const filteredAndSortedJobs = React.useMemo(() => {
    let filtered = jobs.filter(job => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        job.wo_no?.toLowerCase().includes(searchLower) ||
        job.customer?.toLowerCase().includes(searchLower) ||
        job.reference?.toLowerCase().includes(searchLower) ||
        job.category?.toLowerCase().includes(searchLower)
      );
    });

    // Sort jobs
    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      if (sortBy === 'due_date') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      } else {
        aValue = aValue?.toString().toLowerCase() || '';
        bValue = bValue?.toString().toLowerCase() || '';
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [jobs, searchTerm, sortBy, sortOrder]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header with Search and Controls */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {selectedStage ? `${selectedStage} Stage` : 'All Jobs'} ({filteredAndSortedJobs.length})
            </h2>
            {selectedStage && (
              <p className="text-sm text-gray-600">
                Jobs currently in the {selectedStage} production stage
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <ViewToggle 
              view={viewMode} 
              onViewChange={setViewMode}
            />

            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {sortOrder === 'asc' ? <SortAsc className="h-4 w-4 mr-2" /> : <SortDesc className="h-4 w-4 mr-2" />}
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSortBy('due_date')}>
                  {sortBy === 'due_date' && '✓ '}Due Date
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('wo_no')}>
                  {sortBy === 'wo_no' && '✓ '}Job Number
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('customer')}>
                  {sortBy === 'customer' && '✓ '}Customer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('status')}>
                  {sortBy === 'status' && '✓ '}Status
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                  {sortOrder === 'asc' ? 'Sort Descending' : 'Sort Ascending'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search jobs, customers, references..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Jobs List */}
      {filteredAndSortedJobs.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-lg font-medium mb-2">No jobs found</p>
          <p className="text-sm">
            {searchTerm ? 'Try adjusting your search terms.' : 'No jobs match the current filters.'}
          </p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="space-y-2">
          {filteredAndSortedJobs.map((job) => (
            <CompactJobCard
              key={job.id}
              job={job}
              stages={job.stages || []}
              onStageAction={onStageAction}
            />
          ))}
        </div>
      ) : (
        <JobListView
          jobs={filteredAndSortedJobs}
          onStart={onStageAction ? (jobId, stageId) => {
            onStageAction(jobId, stageId, 'start');
            return Promise.resolve(true);
          } : undefined}
          onComplete={onStageAction ? (jobId, stageId) => {
            onStageAction(jobId, stageId, 'complete');
            return Promise.resolve(true);
          } : undefined}
        />
      )}
    </div>
  );
};
