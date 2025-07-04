
import React from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { JobTableRow } from "./JobTableRow";
import { SortableTableHead } from "./SortableTableHead";

interface JobsTableContentProps {
  jobs: any[];
  selectedJobs: string[];
  sortField: string;
  sortOrder: 'asc' | 'desc';
  onSelectJob: (jobId: string, selected: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onSort: (field: string) => void;
  onEditJob: (job: any) => void;
  onCategoryAssign: (job: any) => void;
  onDeleteSingleJob: (jobId: string) => void;
  onCustomWorkflow?: (job: any) => void;
}

export const JobsTableContent: React.FC<JobsTableContentProps> = ({
  jobs,
  selectedJobs,
  sortField,
  sortOrder,
  onSelectJob,
  onSelectAll,
  onSort,
  onEditJob,
  onCategoryAssign,
  onDeleteSingleJob,
  onCustomWorkflow
}) => {
  const isAllSelected = jobs.length > 0 && selectedJobs.length === jobs.length;
  const isPartiallySelected = selectedJobs.length > 0 && selectedJobs.length < jobs.length;

  const handleSelectJob = (job: any, selected: boolean) => {
    onSelectJob(job.id, selected);
  };

  const handleCustomWorkflow = (job: any) => {
    if (onCustomWorkflow) {
      onCustomWorkflow(job);
    }
  };

  return (
    <Card>
      <ScrollArea className="h-[600px]">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left">
                  <Checkbox
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el && el.querySelector('button')) {
                        const button = el.querySelector('button') as HTMLButtonElement;
                        (button as any).indeterminate = isPartiallySelected;
                      }
                    }}
                    onCheckedChange={onSelectAll}
                  />
                </th>
                <SortableTableHead
                  sortKey="wo_no"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                  className="px-6 py-3"
                >
                  WO Number
                </SortableTableHead>
                <SortableTableHead
                  sortKey="customer"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                  className="px-6 py-3"
                >
                  Customer
                </SortableTableHead>
                <SortableTableHead
                  sortKey="reference"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                  className="px-6 py-3"
                >
                  Reference
                </SortableTableHead>
                <SortableTableHead
                  sortKey="qty"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                  className="px-6 py-3"
                >
                  Qty
                </SortableTableHead>
                <SortableTableHead
                  sortKey="category_name"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                  className="px-6 py-3"
                >
                  Category
                </SortableTableHead>
                <SortableTableHead
                  sortKey="status"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                  className="px-6 py-3"
                >
                  Status
                </SortableTableHead>
                <SortableTableHead
                  sortKey="due_date"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                  className="px-6 py-3"
                >
                  Due Date
                </SortableTableHead>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Stage
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {jobs.map((job) => (
                <JobTableRow
                  key={job.id}
                  job={job}
                  isSelected={selectedJobs.includes(job.id)}
                  onSelect={handleSelectJob}
                  onEdit={onEditJob}
                  onCategoryAssign={onCategoryAssign}
                  onCustomWorkflow={handleCustomWorkflow}
                  onDelete={onDeleteSingleJob}
                />
              ))}
            </tbody>
          </table>
        </div>
      </ScrollArea>
    </Card>
  );
};
