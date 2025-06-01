
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  MoreHorizontal,
  Edit,
  Trash2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SortableTableHead } from "./SortableTableHead";

interface JobsTableContentProps {
  jobs: any[];
  selectedJobs: string[];
  sortField: string | null;
  sortOrder: 'asc' | 'desc';
  onSelectJob: (jobId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onSort: (field: string) => void;
  onEditJob: (job: any) => void;
  onCategoryAssign: (job: any) => void;
  onDeleteSingleJob: (jobId: string) => void;
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
  onDeleteSingleJob
}) => {
  const getStatusBadge = (status: string) => {
    const statusLower = status?.toLowerCase() || 'unknown';
    const variants = {
      'completed': 'default' as const,
      'production': 'default' as const,
      'pre-press': 'secondary' as const,
      'printing': 'default' as const,
      'finishing': 'default' as const,
      'packaging': 'default' as const,
      'shipped': 'default' as const
    };
    
    return (
      <Badge variant={variants[statusLower] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  return (
    <Card>
      <CardContent className="p-0">
        <ScrollArea className="h-[600px] w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedJobs.length === jobs.length && jobs.length > 0}
                    onCheckedChange={onSelectAll}
                  />
                </TableHead>
                <SortableTableHead
                  sortKey="wo_no"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                >
                  WO Number
                </SortableTableHead>
                <SortableTableHead
                  sortKey="customer"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                >
                  Customer
                </SortableTableHead>
                <SortableTableHead
                  sortKey="reference"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                >
                  Reference
                </SortableTableHead>
                <SortableTableHead
                  sortKey="qty"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                >
                  Qty
                </SortableTableHead>
                <SortableTableHead
                  sortKey="category"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                >
                  Category
                </SortableTableHead>
                <SortableTableHead
                  sortKey="status"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                >
                  Status
                </SortableTableHead>
                <SortableTableHead
                  sortKey="due_date"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                >
                  Due Date
                </SortableTableHead>
                <SortableTableHead
                  sortKey="current_stage"
                  currentSortField={sortField}
                  currentSortOrder={sortOrder}
                  onSort={onSort}
                >
                  Current Stage
                </SortableTableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedJobs.includes(job.id)}
                      onCheckedChange={(checked) => onSelectJob(job.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{job.wo_no}</TableCell>
                  <TableCell>{job.customer || 'Unknown'}</TableCell>
                  <TableCell>{job.reference || '-'}</TableCell>
                  <TableCell>{job.qty || '-'}</TableCell>
                  <TableCell>
                    {job.category ? (
                      <Badge variant="outline">{job.category}</Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCategoryAssign(job)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        Assign Category
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(job.status)}</TableCell>
                  <TableCell>
                    {job.due_date ? new Date(job.due_date).toLocaleDateString() : 'No due date'}
                  </TableCell>
                  <TableCell>
                    {job.current_stage ? (
                      <Badge className="bg-blue-500">{job.current_stage}</Badge>
                    ) : (
                      <span className="text-gray-400">No workflow</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEditJob(job)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Job
                        </DropdownMenuItem>
                        {!job.category && (
                          <DropdownMenuItem onClick={() => onCategoryAssign(job)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Assign Category
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          className="text-red-600"
                          onClick={() => onDeleteSingleJob(job.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {jobs.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No production jobs found</p>
              <p className="text-gray-400">
                All jobs in production status will appear here
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
