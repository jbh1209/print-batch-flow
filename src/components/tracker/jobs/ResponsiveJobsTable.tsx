
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody } from "@/components/ui/table";
import { Search, RefreshCw, Filter } from "lucide-react";
import { JobTableColumns } from "./JobTableColumns";
import { ResponsiveJobTableRow } from "./ResponsiveJobTableRow";
import { JobBulkActions } from "./JobBulkActions";
import { useEnhancedProductionJobs } from "@/hooks/tracker/useEnhancedProductionJobs";

interface ResponsiveJobsTableProps {
  filters?: {
    search?: string;
    filters?: string[];
  };
}

export const ResponsiveJobsTable: React.FC<ResponsiveJobsTableProps> = ({ 
  filters = {} 
}) => {
  const { jobs, categories, isLoading, refreshJobs } = useEnhancedProductionJobs();
  const [selectedJobs, setSelectedJobs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState(filters.search || '');

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

  // Filter jobs based on search and filters
  const filteredJobs = jobs.filter(job => {
    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        job.wo_no.toLowerCase().includes(searchLower) ||
        job.customer?.toLowerCase().includes(searchLower) ||
        job.reference?.toLowerCase().includes(searchLower) ||
        job.category?.toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;
    }

    // Apply other filters here if needed
    return true;
  });

  const handleCategoryAssign = () => {
    console.log('Category assign for selected jobs:', selectedJobs);
  };

  const handleBulkOperations = () => {
    console.log('Bulk operations for selected jobs:', selectedJobs);
  };

  const handleQRLabels = () => {
    console.log('QR labels for selected jobs:', selectedJobs);
  };

  const handleEditJob = (job: any) => {
    console.log('Edit job:', job);
  };

  const handleDeleteJob = (jobId: string) => {
    console.log('Delete job:', jobId);
  };

  const handleWorkflowInit = (job: any) => {
    console.log('Initialize workflow for job:', job);
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
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Bulk Actions */}
      <JobBulkActions
        selectedCount={selectedJobs.length}
        onCategoryAssign={handleCategoryAssign}
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
    </div>
  );
};
