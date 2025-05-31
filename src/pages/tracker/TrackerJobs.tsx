
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Upload, Users, QrCode } from "lucide-react";
import { Link, useOutletContext, useNavigate } from "react-router-dom";
import { ResponsiveJobsTable } from "@/components/tracker/jobs/ResponsiveJobsTable";
import { JobSelectionModal } from "@/components/tracker/jobs/JobSelectionModal";
import { WorkflowInitializationModal } from "@/components/tracker/jobs/WorkflowInitializationModal";
import { MobileQRScanner } from "@/components/tracker/mobile/MobileQRScanner";
import { useEnhancedProductionJobs } from "@/hooks/tracker/useEnhancedProductionJobs";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

interface TrackerJobsContext {
  activeTab: string;
  filters: any;
}

const TrackerJobs = () => {
  const context = useOutletContext<TrackerJobsContext>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const filters = context?.filters || {};
  
  const { 
    jobs, 
    refreshJobs, 
    startStage, 
    completeStage, 
    recordQRScan 
  } = useEnhancedProductionJobs();
  
  const [isJobSelectionOpen, setIsJobSelectionOpen] = useState(false);
  const [isWorkflowInitOpen, setIsWorkflowInitOpen] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<any[]>([]);

  // Get jobs without workflow for bulk initialization
  const jobsWithoutWorkflow = jobs.filter(job => !job.has_workflow);

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

  const handleBulkWorkflowInit = () => {
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

  const handleAddJob = () => {
    // Navigate to job creation - could be improved to show a modal for selecting job type
    navigate('/tracker/admin');
    toast.info('Please use the Excel upload feature to add new jobs');
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header - Responsive */}
      <div className="bg-white border-b px-4 sm:px-6 py-4 flex-shrink-0">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/tracker" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Dashboard</span>
                <span className="sm:hidden">Back</span>
              </Link>
            </Button>
            
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Jobs Management</h1>
              <p className="text-gray-600 text-sm sm:text-base hidden sm:block">
                View and manage all production jobs with enhanced workflow tracking
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Mobile QR Scanner */}
            {isMobile && (
              <MobileQRScanner
                onScanSuccess={handleQRScan}
                onJobAction={handleStageAction}
              />
            )}
            
            <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
              <Link to="/tracker/upload">
                <Upload className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Import Excel</span>
                <span className="sm:hidden">Import</span>
              </Link>
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleBulkWorkflowInit}
              disabled={jobsWithoutWorkflow.length === 0}
              className="w-full sm:w-auto"
            >
              <Users className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Bulk Workflow</span>
              <span className="sm:hidden">Bulk Init</span>
              {jobsWithoutWorkflow.length > 0 && (
                <span className="ml-1 bg-blue-600 text-white rounded-full px-1.5 py-0.5 text-xs font-medium">
                  {jobsWithoutWorkflow.length}
                </span>
              )}
            </Button>
            
            {/* Desktop QR Scanner */}
            {!isMobile && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full sm:w-auto"
                onClick={handleQRScanner}
              >
                <QrCode className="mr-2 h-4 w-4" />
                QR Scanner
              </Button>
            )}
            
            <Button 
              size="sm" 
              className="w-full sm:w-auto"
              onClick={handleAddJob}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Job
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - Responsive */}
      <div className="flex-1 p-4 sm:p-6 overflow-auto">
        <ResponsiveJobsTable filters={filters} />
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
        title="Bulk Workflow Initialization"
        description="Select jobs to initialize with production workflows"
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

export default TrackerJobs;
