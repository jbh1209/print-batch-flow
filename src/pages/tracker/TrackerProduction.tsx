
import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Settings, QrCode, Users } from "lucide-react";
import { Link, useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { DynamicProductionSidebar } from "@/components/tracker/production/DynamicProductionSidebar";
import { FilteredJobsView } from "@/components/tracker/production/FilteredJobsView";
import { JobSelectionModal } from "@/components/tracker/jobs/JobSelectionModal";
import { WorkflowInitializationModal } from "@/components/tracker/jobs/WorkflowInitializationModal";
import { MobileQRScanner } from "@/components/tracker/mobile/MobileQRScanner";
import { useEnhancedProductionJobs } from "@/hooks/tracker/useEnhancedProductionJobs";
import { useIsMobile } from "@/hooks/use-mobile";

interface TrackerProductionContext {
  activeTab: string;
  filters: any;
}

const TrackerProduction = () => {
  const context = useOutletContext<TrackerProductionContext>();
  const isMobile = useIsMobile();
  const { 
    jobs, 
    isLoading, 
    refreshJobs, 
    startStage, 
    completeStage, 
    recordQRScan 
  } = useEnhancedProductionJobs();
  
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<any>({});
  const [isJobSelectionOpen, setIsJobSelectionOpen] = useState(false);
  const [isWorkflowInitOpen, setIsWorkflowInitOpen] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<any[]>([]);

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

  // Get jobs without workflow for bulk initialization
  const jobsWithoutWorkflow = useMemo(() => {
    return jobs.filter(job => !job.has_workflow);
  }, [jobs]);

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

  const handleQRScan = (data: any) => {
    if (data?.jobId && data?.stageId) {
      handleStageAction(data.jobId, data.stageId, data.action || 'qr-scan');
    }
  };

  const handleInitializeWorkflow = () => {
    if (jobsWithoutWorkflow.length === 0) {
      toast.info('All jobs already have workflows initialized');
      return;
    }
    setIsJobSelectionOpen(true);
  };

  const handleJobSelect = (job: any, selected: boolean) => {
    if (selected) {
      setSelectedJobs(prev => [...prev, job]);
    } else {
      setSelectedJobs(prev => prev.filter(j => j.id !== job.id));
    }
  };

  const handleConfirmJobSelection = () => {
    setIsJobSelectionOpen(false);
    setIsWorkflowInitOpen(true);
  };

  const handleWorkflowSuccess = () => {
    setSelectedJobs([]);
    refreshJobs();
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
            
            <Button variant="outline" size={isMobile ? "sm" : "default"}>
              <Settings className="mr-2 h-4 w-4" />
              {isMobile ? "" : "Configure Stages"}
            </Button>
            
            <Button 
              onClick={handleInitializeWorkflow} 
              size={isMobile ? "sm" : "default"}
              disabled={jobsWithoutWorkflow.length === 0}
            >
              <Plus className="mr-2 h-4 w-4" />
              {isMobile ? "Init" : "Initialize Workflow"}
              {jobsWithoutWorkflow.length > 0 && (
                <span className="ml-1 bg-white text-blue-600 rounded-full px-1.5 py-0.5 text-xs font-medium">
                  {jobsWithoutWorkflow.length}
                </span>
              )}
            </Button>

            {/* Desktop QR Scanner */}
            {!isMobile && (
              <Button variant="outline">
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
            {jobsWithoutWorkflow.length}
          </div>
          <div className="text-xs text-gray-600">Need Setup</div>
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

      {/* Job Selection Modal */}
      <JobSelectionModal
        isOpen={isJobSelectionOpen}
        onClose={() => {
          setIsJobSelectionOpen(false);
          setSelectedJobs([]);
        }}
        jobs={jobsWithoutWorkflow}
        selectedJobs={selectedJobs}
        onJobSelect={handleJobSelect}
        onConfirm={handleConfirmJobSelection}
        title="Select Jobs for Workflow"
        description="Choose jobs to initialize with production workflow"
        confirmText="Initialize Selected"
      />

      {/* Workflow Initialization Modal */}
      <WorkflowInitializationModal
        isOpen={isWorkflowInitOpen}
        onClose={() => {
          setIsWorkflowInitOpen(false);
          setSelectedJobs([]);
        }}
        jobs={selectedJobs}
        onSuccess={handleWorkflowSuccess}
      />
    </div>
  );
};

export default TrackerProduction;
