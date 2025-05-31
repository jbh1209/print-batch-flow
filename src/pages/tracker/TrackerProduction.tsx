
import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Settings } from "lucide-react";
import { Link, useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { DynamicProductionSidebar } from "@/components/tracker/production/DynamicProductionSidebar";
import { FilteredJobsView } from "@/components/tracker/production/FilteredJobsView";
import { useEnhancedProductionJobs } from "@/hooks/tracker/useEnhancedProductionJobs";
import { useWorkflowInitialization } from "@/hooks/tracker/useWorkflowInitialization";

interface TrackerProductionContext {
  activeTab: string;
  filters: any;
}

const TrackerProduction = () => {
  const context = useOutletContext<TrackerProductionContext>();
  const { 
    jobs, 
    isLoading, 
    refreshJobs, 
    startStage, 
    completeStage, 
    recordQRScan 
  } = useEnhancedProductionJobs();
  const { initializeWorkflow, isInitializing } = useWorkflowInitialization();
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<any>({});

  // Filter jobs based on selected stage or other filters
  const filteredJobs = useMemo(() => {
    let filtered = jobs;

    if (activeFilters.stage) {
      filtered = filtered.filter(job => job.current_stage === activeFilters.stage);
    } else if (activeFilters.status) {
      filtered = filtered.filter(job => 
        job.status?.toLowerCase() === activeFilters.status.toLowerCase()
      );
    }

    return filtered;
  }, [jobs, activeFilters]);

  const handleStageSelect = (stageId: string | null) => {
    setSelectedStageId(stageId);
    if (!stageId) {
      setActiveFilters({});
    }
  };

  const handleFilterChange = (filters: any) => {
    setActiveFilters(filters);
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

  const handleInitializeWorkflow = async () => {
    // This would typically be triggered from a job selection modal
    // For now, we'll show a message about implementing the selection UI
    toast.info('Workflow initialization will be available once job selection is implemented');
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
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Production Workflow</h1>
            <p className="text-gray-600">Monitor and manage production stages with real-time tracking</p>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Configure Stages
            </Button>
            <Button onClick={handleInitializeWorkflow} disabled={isInitializing}>
              <Plus className="mr-2 h-4 w-4" />
              {isInitializing ? 'Initializing...' : 'Initialize Workflow'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content with Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        <DynamicProductionSidebar
          selectedStageId={selectedStageId}
          onStageSelect={handleStageSelect}
          onFilterChange={handleFilterChange}
        />
        
        <div className="flex-1 overflow-auto bg-white">
          <FilteredJobsView
            jobs={filteredJobs}
            selectedStage={activeFilters.stage}
            isLoading={isLoading}
            onStageAction={handleStageAction}
          />
        </div>
      </div>
    </div>
  );
};

export default TrackerProduction;
