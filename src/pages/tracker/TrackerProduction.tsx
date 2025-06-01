
import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, QrCode } from "lucide-react";
import { Link, useOutletContext, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FilteredJobsView } from "@/components/tracker/production/FilteredJobsView";
import { MobileQRScanner } from "@/components/tracker/mobile/MobileQRScanner";
import { useEnhancedProductionJobs } from "@/hooks/tracker/useEnhancedProductionJobs";
import { useIsMobile } from "@/hooks/use-mobile";

interface TrackerProductionContext {
  activeTab: string;
  filters: any;
  selectedStageId?: string;
  onStageSelect?: (stageId: string | null) => void;
  onFilterChange?: (filters: any) => void;
}

const TrackerProduction = () => {
  const context = useOutletContext<TrackerProductionContext>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { 
    jobs, 
    isLoading, 
    refreshJobs, 
    startStage, 
    completeStage, 
    recordQRScan 
  } = useEnhancedProductionJobs();
  
  const [activeFilters, setActiveFilters] = useState<any>({});
  const [sortBy, setSortBy] = useState<'wo_no' | 'due_date'>('wo_no');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Use context filters or local filters
  const currentFilters = context?.filters || activeFilters;

  // Filter and sort jobs based on selected stage or other filters
  const filteredJobs = useMemo(() => {
    let filtered = jobs;

    // Apply stage filter
    if (currentFilters.stage) {
      filtered = filtered.filter(job => job.current_stage === currentFilters.stage);
    } else if (currentFilters.status) {
      filtered = filtered.filter(job => 
        job.status?.toLowerCase() === currentFilters.status.toLowerCase()
      );
    }
    // If no filters are applied, show all jobs

    // Sort the filtered jobs
    filtered = [...filtered].sort((a, b) => {
      let aValue, bValue;
      
      if (sortBy === 'wo_no') {
        aValue = a.wo_no || '';
        bValue = b.wo_no || '';
        const comparison = aValue.localeCompare(bValue);
        return sortOrder === 'asc' ? comparison : -comparison;
      } else if (sortBy === 'due_date') {
        aValue = a.due_date ? new Date(a.due_date).getTime() : 0;
        bValue = b.due_date ? new Date(b.due_date).getTime() : 0;
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });

    return filtered;
  }, [jobs, currentFilters, sortBy, sortOrder]);

  // Get jobs without categories (need category assignment instead of workflow init)
  const jobsWithoutCategory = useMemo(() => {
    return jobs.filter(job => !job.category_id);
  }, [jobs]);

  const handleFilterChange = (filters: any) => {
    setActiveFilters(filters);
    context?.onFilterChange?.(filters);
  };

  const handleStageAction = async (jobId: string, stageId: string, action: 'start' | 'complete' | 'qr-scan') => {
    try {
      console.log(`Stage action: ${action} for job ${jobId}, stage ${stageId}`);
      
      let success = false;
      
      switch (action) {
        case 'start':
          success = await startStage(jobId, stageId);
          break;
        case 'complete':
          success = await completeStage(jobId, stageId);
          break;
        case 'qr-scan':
          success = await recordQRScan(jobId, stageId);
          break;
      }

      if (success) {
        // Refresh will happen automatically via the hook's real-time subscription
      }
    } catch (error) {
      console.error('Error performing stage action:', error);
      toast.error('Failed to perform stage action');
    }
  };

  const handleQRScan = (data: any) => {
    if (data?.jobId && data?.stageId) {
      handleStageAction(data.jobId, data.stageId, data.action || 'qr-scan');
    }
  };

  const handleConfigureStages = () => {
    navigate('/tracker/admin');
  };

  const handleQRScanner = () => {
    if (isMobile) {
      // Mobile QR scanner is already visible
      toast.info('QR scanner is available in the header');
    } else {
      // Navigate to a dedicated QR scanner page or show modal
      toast.info('QR scanner functionality - to be implemented');
    }
  };

  const handleSort = (field: 'wo_no' | 'due_date') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6 flex-shrink-0">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/tracker" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
        
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold">Production Workflow</h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Monitor and manage production stages with real-time tracking
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Mobile QR Scanner - Always visible on mobile */}
            {isMobile && (
              <MobileQRScanner
                onScanSuccess={handleQRScan}
                onJobAction={handleStageAction}
              />
            )}
            
            <Button 
              variant="outline" 
              size={isMobile ? "sm" : "default"}
              onClick={handleConfigureStages}
            >
              <Settings className="mr-2 h-4 w-4" />
              {isMobile ? "" : "Configure Stages"}
            </Button>

            {/* Desktop QR Scanner */}
            {!isMobile && (
              <Button 
                variant="outline"
                onClick={handleQRScanner}
              >
                <QrCode className="mr-2 h-4 w-4" />
                QR Scanner
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-3">
          <div className="text-2xl font-bold text-blue-600">{jobs.length}</div>
          <div className="text-xs text-gray-600">Total Jobs</div>
        </div>
        <div className="bg-white rounded-lg border p-3">
          <div className="text-2xl font-bold text-green-600">
            {jobs.filter(j => j.has_workflow).length}
          </div>
          <div className="text-xs text-gray-600">With Workflow</div>
        </div>
        <div className="bg-white rounded-lg border p-3">
          <div className="text-2xl font-bold text-orange-600">
            {jobs.filter(j => j.current_stage).length}
          </div>
          <div className="text-xs text-gray-600">In Progress</div>
        </div>
        <div className="bg-white rounded-lg border p-3">
          <div className="text-2xl font-bold text-red-600">
            {jobsWithoutCategory.length}
          </div>
          <div className="text-xs text-gray-600">Need Category</div>
        </div>
      </div>

      {/* Info Banner */}
      {jobsWithoutCategory.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-700">
            <strong>{jobsWithoutCategory.length} jobs</strong> need category assignment. 
            Once a category is assigned, the due date will be calculated automatically and workflow stages will start immediately.
          </p>
        </div>
      )}

      {/* Sorting Controls */}
      <div className="mb-4 flex gap-2">
        <Button
          variant={sortBy === 'wo_no' ? "default" : "outline"}
          size="sm"
          onClick={() => handleSort('wo_no')}
        >
          Sort by Job Number {sortBy === 'wo_no' && (sortOrder === 'asc' ? '↑' : '↓')}
        </Button>
        <Button
          variant={sortBy === 'due_date' ? "default" : "outline"}
          size="sm"
          onClick={() => handleSort('due_date')}
        >
          Sort by Date Required {sortBy === 'due_date' && (sortOrder === 'asc' ? '↑' : '↓')}
        </Button>
      </div>

      {/* Main Content - Now takes full width */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto bg-white rounded-lg border">
          <FilteredJobsView
            jobs={filteredJobs}
            selectedStage={currentFilters.stage}
            isLoading={isLoading}
            onStageAction={handleStageAction}
          />
        </div>
      </div>
    </div>
  );
};

export default TrackerProduction;
