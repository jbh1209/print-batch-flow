
import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { useCustomWorkflowStatus } from "@/hooks/tracker/useCustomWorkflowStatus";
import { useJobRowColors } from "@/hooks/tracker/useJobRowColors";
import { BulkActionsBar } from "./components/BulkActionsBar";
import { JobRow } from "./components/JobRow";
import { SpecificationFilter, SpecificationFilters } from "../common/SpecificationFilter";

interface EnhancedProductionJobsListProps {
  jobs: AccessibleJob[];
  onStartJob: (jobId: string, stageId: string) => Promise<boolean>;
  onCompleteJob: (jobId: string, stageId: string) => Promise<boolean>;
  onEditJob: (job: AccessibleJob) => void;
  onCategoryAssign: (job: AccessibleJob) => void;
  onCustomWorkflow: (job: AccessibleJob) => void;
  onDeleteJob: (jobId: string) => void;
  onBulkCategoryAssign: (selectedJobs: AccessibleJob[]) => void;
  onBulkStatusUpdate: (selectedJobs: AccessibleJob[], status: string) => void;
  onBulkDelete: (selectedJobs: AccessibleJob[]) => void;
  onGenerateBarcodes: (selectedJobs: AccessibleJob[]) => void;
  onBulkMarkCompleted?: (selectedJobs: AccessibleJob[]) => void;
  onAssignParts?: (job: AccessibleJob) => void;
  isAdmin?: boolean;
  searchQuery?: string;
}

export const EnhancedProductionJobsList: React.FC<EnhancedProductionJobsListProps> = ({
  jobs,
  onStartJob,
  onCompleteJob,
  onEditJob,
  onCategoryAssign,
  onCustomWorkflow,
  onDeleteJob,
  onBulkCategoryAssign,
  onBulkStatusUpdate,
  onBulkDelete,
  onGenerateBarcodes,
  onBulkMarkCompleted,
  onAssignParts,
  isAdmin = false,
  searchQuery: initialSearchQuery = ''
}) => {
  const [selectedJobs, setSelectedJobs] = useState<AccessibleJob[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [specFilters, setSpecFilters] = useState<SpecificationFilters>({});

  // Get job IDs that might need custom workflow status check
  const jobIdsForCustomWorkflowCheck = useMemo(() => {
    return jobs
      .filter(job => !job.category_name || job.category_name === 'No Category')
      .map(job => job.job_id);
  }, [jobs]);

  // Use the custom hook to get real custom workflow status
  const { customWorkflowStatus } = useCustomWorkflowStatus(jobIdsForCustomWorkflowCheck);
  
  // Use the custom hook to get row colors
  const jobRowColors = useJobRowColors(jobs);

  // Extract available specifications for filtering
  const availableSpecs = useMemo(() => {
    return {
      sizes: [],
      paperTypes: [],
      paperWeights: [],
      laminations: []
    };
  }, [jobs]);

  // Filter jobs based on search and specifications
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Search filter
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = 
          job.wo_no?.toLowerCase().includes(searchLower) ||
          job.customer?.toLowerCase().includes(searchLower) ||
          job.reference?.toLowerCase().includes(searchLower) ||
          job.category_name?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Specification filters
      if (specFilters.searchTerm) {
        const searchLower = specFilters.searchTerm.toLowerCase();
        const matchesSpecSearch = 
          job.wo_no?.toLowerCase().includes(searchLower) ||
          job.customer?.toLowerCase().includes(searchLower);
        if (!matchesSpecSearch) return false;
      }

      return true;
    });
  }, [jobs, searchQuery, specFilters]);

  const handleSelectJob = (job: AccessibleJob, checked: boolean) => {
    if (checked) {
      setSelectedJobs(prev => [...prev, job]);
    } else {
      setSelectedJobs(prev => prev.filter(j => j.job_id !== job.job_id));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobs(filteredJobs);
    } else {
      setSelectedJobs([]);
    }
  };

  const clearSelection = () => {
    setSelectedJobs([]);
  };

  const handleSelectAllVisible = (visibleJobs: AccessibleJob[]) => {
    setSelectedJobs(visibleJobs);
  };

  const isSelected = (job: AccessibleJob) => {
    return selectedJobs.some(j => j.job_id === job.job_id);
  };

  // Helper function to determine if job has custom workflow
  const hasCustomWorkflow = (job: AccessibleJob) => {
    // First check the hook's result for jobs without categories
    if (customWorkflowStatus[job.job_id] !== undefined) {
      return customWorkflowStatus[job.job_id];
    }
    // Fallback to the job's original property
    return job.has_custom_workflow;
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
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
        
        <SpecificationFilter
          onFilterChange={setSpecFilters}
          availableSpecs={availableSpecs}
        />
      </div>

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedJobs={selectedJobs}
        onBulkCategoryAssign={onBulkCategoryAssign}
        onBulkStatusUpdate={onBulkStatusUpdate}
        onBulkMarkCompleted={onBulkMarkCompleted}
        onCustomWorkflow={onCustomWorkflow}
        onGenerateBarcodes={onGenerateBarcodes}
        onBulkDelete={onBulkDelete}
        onClearSelection={clearSelection}
        isAdmin={isAdmin}
        allVisibleJobs={filteredJobs}
        searchQuery={searchQuery}
        onSelectAllVisible={handleSelectAllVisible}
      />

      {/* Jobs List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Production Jobs Overview ({filteredJobs.length})</CardTitle>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedJobs.length === filteredJobs.length && filteredJobs.length > 0}
                onCheckedChange={handleSelectAll}
                disabled={filteredJobs.length === 0}
              />
              <span className="text-sm text-gray-600">Select All</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredJobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg font-medium mb-2">No jobs found</p>
              <p className="text-sm">
                {searchQuery || Object.keys(specFilters).length > 0
                  ? 'Try adjusting your search terms or filters.'
                  : 'No jobs match the current criteria.'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredJobs.map((job) => (
                <JobRow
                  key={job.job_id}
                  job={job}
                  isSelected={isSelected(job)}
                  hasCustomWorkflow={hasCustomWorkflow(job)}
                  rowColorClass={jobRowColors[job.job_id] || ''}
                  onSelectJob={handleSelectJob}
                  onStartJob={onStartJob}
                  onCompleteJob={onCompleteJob}
                  onEditJob={onEditJob}
                  onCategoryAssign={onCategoryAssign}
                  onCustomWorkflow={onCustomWorkflow}
                  onDeleteJob={onDeleteJob}
                  onAssignParts={onAssignParts}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
