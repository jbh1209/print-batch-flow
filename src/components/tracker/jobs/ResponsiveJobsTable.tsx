import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody } from "@/components/ui/table";
import { Search, RefreshCw, Filter } from "lucide-react";
import { JobTableColumns } from "./JobTableColumns";
import { ResponsiveJobTableRow } from "./ResponsiveJobTableRow";
import { JobBulkActions } from "./JobBulkActions";
import { JobEditModal } from "./JobEditModal";
import { CategoryAssignModal } from "./CategoryAssignModal";
import { WorkflowInitModal } from "./WorkflowInitModal";
import { BulkJobOperations } from "./BulkJobOperations";
import { QRLabelsManager } from "../QRLabelsManager";
import { ColumnFilters } from "./ColumnFilters";
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

  // Extract unique values for filter dropdowns
  const availableCategories = useMemo(() => {
    const categories = [...new Set(jobs.map(job => job.category).filter(Boolean))];
    return categories.sort();
  }, [jobs]);

  const availableStatuses = useMemo(() => {
    const statuses = [...new Set(jobs.map(job => job.status).filter(Boolean))];
    return statuses.sort();
  }, [jobs]);

  const availableStages = useMemo(() => {
    const stages = [...new Set(jobs.map(job => job.current_stage).filter(Boolean))];
    return stages.sort();
  }, [jobs]);

  const handleSelectJob = (job: any, selected: boolean) => {
    if (selected) {
      setSelectedJobs(prev => [...prev, job]);
    } else {
      setSelectedJobs(prev => prev.filter(j => j.id !== job.id));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedJobs(filteredJobs);
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

  // Enhanced filtering logic
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Search filter
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = 
          job.wo_no?.toLowerCase().includes(searchLower) ||
          job.customer?.toLowerCase().includes(searchLower) ||
          job.reference?.toLowerCase().includes(searchLower) ||
          job.category?.toLowerCase().includes(searchLower);
        
        if (!matchesSearch) return false;
      }

      // Column filters
      if (columnFilters.woNumber && !job.wo_no?.toLowerCase().includes(columnFilters.woNumber.toLowerCase())) {
        return false;
      }

      if (columnFilters.customer && !job.customer?.toLowerCase().includes(columnFilters.customer.toLowerCase())) {
        return false;
      }

      if (columnFilters.reference && !job.reference?.toLowerCase().includes(columnFilters.reference.toLowerCase())) {
        return false;
      }

      if (columnFilters.category && job.category !== columnFilters.category) {
        return false;
      }

      if (columnFilters.status && job.status !== columnFilters.status) {
        return false;
      }

      if (columnFilters.currentStage && job.current_stage !== columnFilters.currentStage) {
        return false;
      }

      // Due date filter
      if (columnFilters.dueDate && job.due_date) {
        const dueDate = new Date(job.due_date);
        const today = new Date();
        
        switch (columnFilters.dueDate) {
          case 'overdue':
            if (!isBefore(dueDate, startOfDay(today))) return false;
            break;
          case 'today':
            if (!isToday(dueDate)) return false;
            break;
          case 'thisWeek':
            const weekStart = startOfWeek(today);
            const weekEnd = endOfWeek(today);
            if (isBefore(dueDate, weekStart) || isAfter(dueDate, weekEnd)) return false;
            break;
          case 'nextWeek':
            const nextWeekStart = startOfWeek(addWeeks(today, 1));
            const nextWeekEnd = endOfWeek(addWeeks(today, 1));
            if (isBefore(dueDate, nextWeekStart) || isAfter(dueDate, nextWeekEnd)) return false;
            break;
          case 'noDate':
            if (job.due_date) return false;
            break;
        }
      } else if (columnFilters.dueDate === 'noDate' && job.due_date) {
        return false;
      }

      return true;
    });
  }, [jobs, searchQuery, columnFilters]);

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
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <CardTitle className="text-lg">Production Jobs ({filteredJobs.length})</CardTitle>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search jobs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-full sm:w-64"
                />
              </div>
              
              <div className="flex gap-2">
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
                totalCount={filteredJobs.length}
                onSelectAll={handleSelectAll}
              />
              <TableBody>
                {filteredJobs.map((job) => (
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

            {filteredJobs.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No jobs found</p>
                <p className="text-gray-400">Try adjusting your search or filters</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      {editingJob && (
        <JobEditModal
          job={editingJob}
          onClose={() => setEditingJob(null)}
          onSave={handleEditJobSave}
        />
      )}

      {categoryAssignJob && (
        <CategoryAssignModal
          job={categoryAssignJob}
          categories={categories}
          onClose={() => setCategoryAssignJob(null)}
          onAssign={handleCategoryAssignComplete}
        />
      )}

      {workflowInitJob && (
        <WorkflowInitModal
          job={workflowInitJob}
          categories={categories}
          onClose={() => setWorkflowInitJob(null)}
          onInitialize={handleWorkflowInitialize}
        />
      )}

      <BulkJobOperations
        isOpen={showBulkOperations}
        onClose={() => setShowBulkOperations(false)}
        selectedJobs={selectedJobs}
        categories={categories}
        onOperationComplete={() => {
          setSelectedJobs([]);
          refreshJobs();
        }}
      />

      {showQRLabels && (
        <QRLabelsManager
          selectedJobs={selectedJobs}
          onClose={() => setShowQRLabels(false)}
        />
      )}
    </div>
  );
};
