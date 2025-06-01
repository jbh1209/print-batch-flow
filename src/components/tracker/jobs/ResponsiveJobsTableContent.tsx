
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody } from "@/components/ui/table";
import { JobTableColumns } from "./JobTableColumns";
import { ResponsiveJobTableRow } from "./ResponsiveJobTableRow";

interface ResponsiveJobsTableContentProps {
  filteredAndSortedJobs: any[];
  selectedJobs: any[];
  sortField: string | null;
  sortOrder: 'asc' | 'desc';
  onSelectJob: (job: any, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onSort: (field: string) => void;
  onEditJob: (job: any) => void;
  onCategoryAssign: (job?: any) => void;
  onWorkflowInit: (job: any) => void;
  onDeleteJob: (jobId: string) => void;
}

export const ResponsiveJobsTableContent: React.FC<ResponsiveJobsTableContentProps> = ({
  filteredAndSortedJobs,
  selectedJobs,
  sortField,
  sortOrder,
  onSelectJob,
  onSelectAll,
  onSort,
  onEditJob,
  onCategoryAssign,
  onWorkflowInit,
  onDeleteJob
}) => {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <JobTableColumns
              selectedCount={selectedJobs.length}
              totalCount={filteredAndSortedJobs.length}
              onSelectAll={onSelectAll}
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={onSort}
            />
            <TableBody>
              {filteredAndSortedJobs.map((job) => (
                <ResponsiveJobTableRow
                  key={job.id}
                  job={job}
                  isSelected={selectedJobs.some(j => j.id === job.id)}
                  onSelectJob={onSelectJob}
                  onEditJob={onEditJob}
                  onCategoryAssign={onCategoryAssign}
                  onWorkflowInit={onWorkflowInit}
                  onDeleteJob={onDeleteJob}
                />
              ))}
            </TableBody>
          </Table>

          {filteredAndSortedJobs.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No jobs found</p>
              <p className="text-gray-400">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
