
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
import { JobEditModal } from "../jobs/JobEditModal";
import { CategoryAssignModal } from "../jobs/CategoryAssignModal";
import { CustomWorkflowModal } from "../jobs/CustomWorkflowModal";
import { QRLabelsManager } from "../QRLabelsManager";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { useCategories } from "@/hooks/tracker/useCategories";
import { toast } from "sonner";

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
  const { categories } = useCategories();
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>('wo_no');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [statusFilter, setStatusFilter] = useState<string>('');
  
  // Modal states
  const [editingJob, setEditingJob] = useState<AccessibleJob | null>(null);
  const [categoryAssignJob, setCategoryAssignJob] = useState<AccessibleJob | null>(null);
  const [customWorkflowJob, setCustomWorkflowJob] = useState<AccessibleJob | null>(null);
  const [showCustomWorkflow, setShowCustomWorkflow] = useState(false);
  const [showQRLabels, setShowQRLabels] = useState(false);
  const [selectedJobsForQR, setSelectedJobsForQR] = useState<AccessibleJob[]>([]);

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
    if (checked) {
      setSelectedJobs(filteredAndSortedJobs.map(job => job.job_id));
    } else {
      setSelectedJobs([]);
    }
  };

  const handleSelectJob = (jobId: string, checked: boolean) => {
    if (checked) {
      setSelectedJobs(prev => [...prev, jobId]);
    } else {
      setSelectedJobs(prev => prev.filter(id => id !== jobId));
    }
  };

  const handleJobClick = (job: AccessibleJob) => {
    // Open job details modal or navigate to job detail page
    console.log("Job clicked:", job);
    toast.info(`Opening details for job ${job.wo_no}`);
  };

  const handleCustomWorkflow = (job: AccessibleJob) => {
    setCustomWorkflowJob(job);
    setShowCustomWorkflow(true);
  };

  const handleGenerateQR = () => {
    const selectedJobsData = jobs.filter(job => selectedJobs.includes(job.job_id));
    setSelectedJobsForQR(selectedJobsData);
    setShowQRLabels(true);
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
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Search and Filters */}
          <div className="p-4 space-y-4 border-b bg-gray-50">
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
              
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">All Statuses</option>
                {uniqueStatuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            {/* Bulk Actions */}
            {selectedJobs.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Badge variant="secondary">{selectedJobs.length} selected</Badge>
                <Button size="sm" variant="outline" onClick={handleGenerateQR}>
                  Generate QR Labels
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setSelectedJobs([])}
                >
                  Clear Selection
                </Button>
              </div>
            )}
          </div>

          {/* Jobs Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedJobs.length === filteredAndSortedJobs.length && filteredAndSortedJobs.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-8">Due</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('wo_no')}
                  >
                    <div className="flex items-center gap-2">
                      Job Number
                      {sortField === 'wo_no' && (
                        sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('customer')}
                  >
                    <div className="flex items-center gap-2">
                      Customer
                      {sortField === 'customer' && (
                        sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('due_date')}
                  >
                    <div className="flex items-center gap-2">
                      Due Date
                      {sortField === 'due_date' && (
                        sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Current Stage</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-2">
                      Status
                      {sortField === 'status' && (
                        sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedJobs.map((job) => (
                  <TableRow 
                    key={job.job_id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleJobClick(job)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedJobs.includes(job.job_id)}
                        onCheckedChange={(checked) => handleSelectJob(job.job_id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell>
                      <TrafficLightIndicator dueDate={job.due_date} />
                    </TableCell>
                    <TableCell className="font-medium">{job.wo_no}</TableCell>
                    <TableCell>{job.customer || 'N/A'}</TableCell>
                    <TableCell>{job.reference || 'N/A'}</TableCell>
                    <TableCell>
                      {job.due_date ? new Date(job.due_date).toLocaleDateString() : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {job.current_stage_name || job.display_stage_name || 'No Stage'}
                      </Badge>
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
                        <Badge variant="secondary">No Category</Badge>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingJob(job)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Job
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setCategoryAssignJob(job)}>
                            <Tag className="h-4 w-4 mr-2" />
                            Assign Category
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCustomWorkflow(job)}>
                            <Workflow className="h-4 w-4 mr-2" />
                            Custom Workflow
                          </DropdownMenuItem>
                          {isAdmin && (
                            <DropdownMenuItem 
                              onClick={() => onDeleteJob(job.job_id)}
                              className="text-red-600"
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
              </TableBody>
            </Table>
          </div>

          {filteredAndSortedJobs.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No jobs found</p>
              <p className="text-gray-400">Try adjusting your search or filters</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {editingJob && (
        <JobEditModal
          job={editingJob}
          onClose={() => setEditingJob(null)}
          onSave={() => {
            setEditingJob(null);
            toast.success('Job updated successfully');
          }}
        />
      )}

      {categoryAssignJob && (
        <CategoryAssignModal
          job={categoryAssignJob}
          categories={categories}
          onClose={() => setCategoryAssignJob(null)}
          onAssign={() => {
            setCategoryAssignJob(null);
            toast.success('Category assigned successfully');
          }}
        />
      )}

      {showCustomWorkflow && customWorkflowJob && (
        <CustomWorkflowModal
          job={customWorkflowJob}
          isOpen={showCustomWorkflow}
          onClose={() => {
            setShowCustomWorkflow(false);
            setCustomWorkflowJob(null);
          }}
          onSuccess={() => {
            setShowCustomWorkflow(false);
            setCustomWorkflowJob(null);
            toast.success('Custom workflow created successfully');
          }}
        />
      )}

      {showQRLabels && (
        <QRLabelsManager
          selectedJobs={selectedJobsForQR}
          onClose={() => {
            setShowQRLabels(false);
            setSelectedJobsForQR([]);
          }}
        />
      )}
    </>
  );
};
