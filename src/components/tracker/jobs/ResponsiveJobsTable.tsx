import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody } from "@/components/ui/table";
import { RefreshCw } from "lucide-react";
import { JobTableColumns } from "./JobTableColumns";
import { ResponsiveJobTableRow } from "./ResponsiveJobTableRow";
import { JobBulkActions } from "./JobBulkActions";
import { JobsTableHeader } from "./JobsTableHeader";
import { JobsTableModals } from "./JobsTableModals";
import { ColumnFilters } from "./ColumnFilters";
import { useJobsTableFilters } from "./JobsTableFilters";
import { useJobsTableSorting } from "./JobsTableSorting";
import { useEnhancedProductionJobs } from "@/hooks/tracker/useEnhancedProductionJobs";
import { useCategories } from "@/hooks/tracker/useCategories";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isAfter, isBefore, startOfDay, endOfDay, addWeeks, isToday, startOfWeek, endOfWeek } from "date-fns";

interface ResponsiveJobsTableProps {
  filters?: {
    search?: string;
    filters?: string[];
  };
}

export const ResponsiveJobsTable: React.FC<ResponsiveJobsTableProps> = ({ 
  filters = {} 
}) => {
  const { jobs, isLoading, refreshJobs } = useEnhancedProductionJobs();
  const { categories } = useCategories();
  const [selectedJobs, setSelectedJobs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState(filters.search || '');
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
  
  // Modal states
  const [editingJob, setEditingJob] = useState<any>(null);
  const [categoryAssignJob, setCategoryAssignJob] = useState<any>(null);
  const [workflowInitJob, setWorkflowInitJob] = useState<any>(null);
  const [showBulkOperations, setShowBulkOperations] = useState(false);
  const [showQRLabels, setShowQRLabels] = useState(false);

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

  const handleSelectJob = (job: any, selected: boolean) => {
    if (selected) {
      setSelectedJobs(prev => [...prev, job]);
    } else {
      setSelectedJobs(prev => prev.filter(j => j.id !== job.id));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedJobs(filteredAndSortedJobs);
    } else {
      setSelectedJobs([]);
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

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleCategoryAssign = (job?: any) => {
    if (job) {
      setCategoryAssignJob(job);
    } else if (selectedJobs.length > 0) {
      // Bulk category assignment - use first job for modal
      setCategoryAssignJob(selectedJobs[0]);
    }
  };

  const handleBulkOperations = () => {
    setShowBulkOperations(true);
  };

  const handleQRLabels = () => {
    setShowQRLabels(true);
  };

  const handleEditJob = (job: any) => {
    setEditingJob(job);
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('production_jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;

      toast.success('Job deleted successfully');
      refreshJobs();
      
      // Clear selection if deleted job was selected
      setSelectedJobs(prev => prev.filter(j => j.id !== jobId));
    } catch (err) {
      console.error('Error deleting job:', err);
      toast.error('Failed to delete job');
    }
  };

  const handleWorkflowInit = (job: any) => {
    setWorkflowInitJob(job);
  };

  const handleWorkflowInitialize = async (job: any, categoryId: string) => {
    try {
      const { error } = await supabase
        .from('production_jobs')
        .update({ 
          category_id: categoryId,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);

      if (error) throw error;

      toast.success('Workflow initialized successfully');
      setWorkflowInitJob(null);
      refreshJobs();
    } catch (err) {
      console.error('Error initializing workflow:', err);
      toast.error('Failed to initialize workflow');
    }
  };

  const handleCategoryAssignComplete = () => {
    setCategoryAssignJob(null);
    refreshJobs();
    setSelectedJobs([]);
  };

  const handleEditJobSave = () => {
    setEditingJob(null);
    refreshJobs();
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
      {/* Search and Actions */}
      <JobsTableHeader
        jobCount={filteredAndSortedJobs.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRefresh={refreshJobs}
        showColumnFilters={showColumnFilters}
        onToggleColumnFilters={() => setShowColumnFilters(!showColumnFilters)}
      />

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
      <JobBulkActions
        selectedCount={selectedJobs.length}
        onCategoryAssign={() => handleCategoryAssign()}
        onBulkOperations={handleBulkOperations}
        onQRLabels={handleQRLabels}
        onClearSelection={() => setSelectedJobs([])}
      />

      {/* Jobs Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <JobTableColumns
                selectedCount={selectedJobs.length}
                totalCount={filteredAndSortedJobs.length}
                onSelectAll={handleSelectAll}
                sortField={sortField}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
              <TableBody>
                {filteredAndSortedJobs.map((job) => (
                  <ResponsiveJobTableRow
                    key={job.id}
                    job={job}
                    isSelected={selectedJobs.some(j => j.id === job.id)}
                    onSelectJob={handleSelectJob}
                    onEditJob={handleEditJob}
                    onCategoryAssign={handleCategoryAssign}
                    onWorkflowInit={handleWorkflowInit}
                    onDeleteJob={handleDeleteJob}
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

      {/* Modals */}
      <JobsTableModals
        editingJob={editingJob}
        categoryAssignJob={categoryAssignJob}
        workflowInitJob={workflowInitJob}
        showBulkOperations={showBulkOperations}
        showQRLabels={showQRLabels}
        selectedJobs={selectedJobs}
        categories={categories}
        onCloseEditJob={() => setEditingJob(null)}
        onCloseCategoryAssign={() => setCategoryAssignJob(null)}
        onCloseWorkflowInit={() => setWorkflowInitJob(null)}
        onCloseBulkOperations={() => setShowBulkOperations(false)}
        onCloseQRLabels={() => setShowQRLabels(false)}
        onEditJobSave={handleEditJobSave}
        onCategoryAssignComplete={handleCategoryAssignComplete}
        onWorkflowInitialize={handleWorkflowInitialize}
        onOperationComplete={() => {
          setSelectedJobs([]);
          refreshJobs();
        }}
      />
    </div>
  );
};
