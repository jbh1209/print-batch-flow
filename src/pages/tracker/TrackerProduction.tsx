
import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Settings } from "lucide-react";
import { Link, useOutletContext } from "react-router-dom";
import { DynamicProductionSidebar } from "@/components/tracker/production/DynamicProductionSidebar";
import { FilteredJobsView } from "@/components/tracker/production/FilteredJobsView";
import { useEnhancedProductionJobs } from "@/hooks/tracker/useEnhancedProductionJobs";

interface TrackerProductionContext {
  activeTab: string;
  filters: any;
}

const TrackerProduction = () => {
  const context = useOutletContext<TrackerProductionContext>();
  const { jobs, isLoading } = useEnhancedProductionJobs();
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
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Initialize Workflow
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
          />
        </div>
      </div>
    </div>
  );
};

export default TrackerProduction;
