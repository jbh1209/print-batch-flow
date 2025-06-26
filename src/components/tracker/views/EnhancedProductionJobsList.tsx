
import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Search, 
  MoreVertical, 
  Play, 
  CheckCircle, 
  Edit, 
  Tag, 
  Workflow, 
  Trash2,
  SortAsc,
  SortDesc,
  Filter
} from "lucide-react";
import { TrafficLightIndicator } from "../production/TrafficLightIndicator";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { useProductionJobs } from "@/contexts/ProductionJobsContext";

interface EnhancedProductionJobsListProps {
  jobs: AccessibleJob[];
  onStartJob: (jobId: string, stageId?: string) => Promise<boolean>;
  onCompleteJob: (jobId: string, stageId?: string) => Promise<boolean>;
  onDeleteJob: (jobId: string) => Promise<void>;
  isAdmin: boolean;
}

type SortField = 'wo_no' | 'customer' | 'due_date' | 'status' | 'category';
type SortOrder = 'asc' | 'desc';

export const EnhancedProductionJobsList: React.FC<EnhancedProductionJobsListProps> = ({
  jobs,
  onStartJob,
  onCompleteJob,
  onDeleteJob,
  isAdmin,
}) => {
  const {
    selectedJobs,
    selectJob,
    selectAllJobs,
    setEditingJob,
    setCategoryAssignJob,
    setCustomWorkflowJob,
    setShowCustomWorkflow,
  } = useProductionJobs();

  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>('wo_no');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Filter and sort jobs
  const filteredAndSortedJobs = useMemo(() => {
    let filtered = jobs;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(job =>
        job.wo_no?.toLowerCase().includes(query) ||
        job.customer?.toLowerCase().includes(query) ||
        job.reference?.toLowerCase().includes(query) ||
        job.category_name?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter(job => job.status === statusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      // Handle date sorting
      if (sortField === 'due_date') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      } else {
        aValue = aValue.toString().toLowerCase();
        bValue = bValue.toString().toLowerCase();
      }

      const comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [jobs, searchQuery, statusFilter, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    selectAllJobs(filteredAndSortedJobs, checked);
  };

  const handleSelectJob = (jobId: string, checked: boolean) => {
    selectJob(jobId, checked);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'default';
      case 'pending': return 'secondary';
      case 'on hold': return 'destructive';
      case 'completed': return 'outline';
      default: return 'secondary';
    }
  };

  const uniqueStatuses = Array.from(new Set(jobs.map(job => job.status))).filter(Boolean);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Search and Filters - Sticky within the card */}
        <div className="sticky top-0 z-20 bg-white border-b p-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search jobs, customers, references..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  {statusFilter || 'All Status'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white">
                <DropdownMenuItem onClick={() => setStatusFilter('')}>
                  All Status
                </DropdownMenuItem>
                {uniqueStatuses.map((status) => (
                  <DropdownMenuItem key={status} onClick={() => setStatusFilter(status)}>
                    {status}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Jobs Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-[88px] z-10 bg-gray-50">
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedJobs.length === filteredAndSortedJobs.length && filteredAndSortedJobs.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-12">Due</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('wo_no')}
                >
                  <div className="flex items-center">
                    Job Number
                    {sortField === 'wo_no' && (
                      sortOrder === 'asc' ? <SortAsc className="ml-2 h-4 w-4" /> : <SortDesc className="ml-2 h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('customer')}
                >
                  <div className="flex items-center">
                    Customer
                    {sortField === 'customer' && (
                      sortOrder === 'asc' ? <SortAsc className="ml-2 h-4 w-4" /> : <SortDesc className="ml-2 h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('due_date')}
                >
                  <div className="flex items-center">
                    Due Date
                    {sortField === 'due_date' && (
                      sortOrder === 'asc' ? <SortAsc className="ml-2 h-4 w-4" /> : <SortDesc className="ml-2 h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead>Current Stage</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status
                    {sortField === 'status' && (
                      sortOrder === 'asc' ? <SortAsc className="ml-2 h-4 w-4" /> : <SortDesc className="ml-2 h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('category')}
                >
                  <div className="flex items-center">
                    Category
                    {sortField === 'category' && (
                      sortOrder === 'asc' ? <SortAsc className="ml-2 h-4 w-4" /> : <SortDesc className="ml-2 h-4 w-4" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedJobs.map((job) => (
                <TableRow 
                  key={job.job_id}
                  className={`hover:bg-gray-50 ${selectedJobs.includes(job.job_id) ? 'bg-blue-50' : ''}`}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedJobs.includes(job.job_id)}
                      onCheckedChange={(checked) => handleSelectJob(job.job_id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell>
                    <TrafficLightIndicator dueDate={job.due_date} />
                  </TableCell>
                  <TableCell className="font-medium">{job.wo_no || 'N/A'}</TableCell>
                  <TableCell>{job.customer || 'N/A'}</TableCell>
                  <TableCell>{job.due_date || 'No due date'}</TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600">
                      {job.current_stage_name || job.display_stage_name || 'Not started'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(job.status)}>
                      {job.status || 'Unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {job.category_name ? (
                      <Badge variant="outline">{job.category_name}</Badge>
                    ) : (
                      <span className="text-xs text-gray-400">No category</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-white">
                        <DropdownMenuItem onClick={() => onStartJob(job.job_id)}>
                          <Play className="h-4 w-4 mr-2" />
                          Start
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onCompleteJob(job.job_id)}>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Complete
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditingJob(job)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setCategoryAssignJob(job)}>
                          <Tag className="h-4 w-4 mr-2" />
                          Assign Category
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => {
                            setCustomWorkflowJob(job);
                            setShowCustomWorkflow(true);
                          }}
                        >
                          <Workflow className="h-4 w-4 mr-2" />
                          Custom Workflow
                        </DropdownMenuItem>
                        {isAdmin && (
                          <DropdownMenuItem 
                            onClick={() => onDeleteJob(job.job_id)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filteredAndSortedJobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    No jobs found matching the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
