import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  RefreshCw, 
  Search, 
  Filter,
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
import { useEnhancedProductionJobs } from "@/hooks/tracker/useEnhancedProductionJobs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { JobsBulkActions } from "./JobsBulkActions";
import { BulkDeleteConfirmDialog } from "./BulkDeleteConfirmDialog";
import { SortableTableHead } from "./SortableTableHead";
import { ColumnFilters } from "./ColumnFilters";
import { useJobsTableFilters } from "./JobsTableFilters";
import { useJobsTableSorting } from "./JobsTableSorting";

export const EnhancedJobsTableWithBulkActions: React.FC = () => {
  const { jobs, isLoading, refreshJobs } = useEnhancedProductionJobs();
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showColumnFilters, setShowColumnFilters] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Column filters state
  const [columnFilters, setColumnFilters] = useState({
    woNumber: '',
    customer: '',
    reference: '',
    category: '',
    status: '',
    dueDate: '',
    currentStage: ''
  });

  // Use filtering hook
  const { filteredJobs, availableCategories, availableStatuses, availableStages } = useJobsTableFilters({
    jobs,
    searchQuery,
    columnFilters
  });

  // Use sorting hook
  const filteredAndSortedJobs = useJobsTableSorting({
    jobs: filteredJobs,
    sortField,
    sortOrder
  });

  const handleSelectJob = (jobId: string, checked: boolean) => {
    if (checked) {
      setSelectedJobs(prev => [...prev, jobId]);
    } else {
      setSelectedJobs(prev => prev.filter(id => id !== jobId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobs(filteredAndSortedJobs.map(job => job.id));
    } else {
      setSelectedJobs([]);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleColumnFilterChange = (key: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleClearColumnFilters = () => {
    setColumnFilters({
      woNumber: '',
      customer: '',
      reference: '',
      category: '',
      status: '',
      dueDate: '',
      currentStage: ''
    });
  };

  const handleBulkDelete = () => {
    setShowDeleteDialog(true);
  };

  const handleConfirmBulkDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('production_jobs')
        .delete()
        .in('id', selectedJobs);

      if (error) throw error;

      toast.success(`Successfully deleted ${selectedJobs.length} job${selectedJobs.length > 1 ? 's' : ''}`);
      setSelectedJobs([]);
      setShowDeleteDialog(false);
      refreshJobs();
    } catch (err) {
      console.error('Error deleting jobs:', err);
      toast.error('Failed to delete jobs');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSingleJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('production_jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;

      toast.success('Job deleted successfully');
      refreshJobs();
      
      // Remove from selection if it was selected
      setSelectedJobs(prev => prev.filter(id => id !== jobId));
    } catch (err) {
      console.error('Error deleting job:', err);
      toast.error('Failed to delete job');
    }
  };

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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading jobs...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header and Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Production Jobs ({filteredAndSortedJobs.length})</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search jobs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button variant="outline" size="sm" onClick={refreshJobs}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowColumnFilters(!showColumnFilters)}
                className={showColumnFilters ? "bg-blue-50 border-blue-200" : ""}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Column Filters */}
      {showColumnFilters && (
        <Card>
          <ColumnFilters
            filters={columnFilters}
            onFilterChange={handleColumnFilterChange}
            onClearFilters={handleClearColumnFilters}
            availableCategories={availableCategories}
            availableStatuses={availableStatuses}
            availableStages={availableStages}
          />
        </Card>
      )}

      {/* Bulk Actions */}
      <JobsBulkActions
        selectedCount={selectedJobs.length}
        onBulkDelete={handleBulkDelete}
        onClearSelection={() => setSelectedJobs([])}
        isDeleting={isDeleting}
      />

      {/* Jobs Table with ScrollArea */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px] w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedJobs.length === filteredAndSortedJobs.length && filteredAndSortedJobs.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <SortableTableHead
                    sortKey="wo_no"
                    currentSortField={sortField}
                    currentSortOrder={sortOrder}
                    onSort={handleSort}
                  >
                    WO Number
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="customer"
                    currentSortField={sortField}
                    currentSortOrder={sortOrder}
                    onSort={handleSort}
                  >
                    Customer
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="reference"
                    currentSortField={sortField}
                    currentSortOrder={sortOrder}
                    onSort={handleSort}
                  >
                    Reference
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="qty"
                    currentSortField={sortField}
                    currentSortOrder={sortOrder}
                    onSort={handleSort}
                  >
                    Qty
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="category"
                    currentSortField={sortField}
                    currentSortOrder={sortOrder}
                    onSort={handleSort}
                  >
                    Category
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="status"
                    currentSortField={sortField}
                    currentSortOrder={sortOrder}
                    onSort={handleSort}
                  >
                    Status
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="due_date"
                    currentSortField={sortField}
                    currentSortOrder={sortOrder}
                    onSort={handleSort}
                  >
                    Due Date
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="current_stage"
                    currentSortField={sortField}
                    currentSortOrder={sortOrder}
                    onSort={handleSort}
                  >
                    Current Stage
                  </SortableTableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedJobs.includes(job.id)}
                        onCheckedChange={(checked) => handleSelectJob(job.id, checked as boolean)}
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
                        <Badge variant="secondary">No Category</Badge>
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
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Job
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => handleDeleteSingleJob(job.id)}
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

            {filteredAndSortedJobs.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No jobs found</p>
                <p className="text-gray-400">
                  {searchQuery ? 'Try adjusting your search' : 'No jobs available'}
                </p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Bulk Delete Confirmation Dialog */}
      <BulkDeleteConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleConfirmBulkDelete}
        jobCount={selectedJobs.length}
        isDeleting={isDeleting}
      />
    </div>
  );
};
