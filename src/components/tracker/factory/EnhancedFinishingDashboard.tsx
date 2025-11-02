import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, RefreshCw, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAccessibleJobs } from '@/hooks/tracker/useAccessibleJobs';
import { useJobActions } from '@/hooks/tracker/useAccessibleJobs/useJobActions';
import { useUserRole } from '@/hooks/tracker/useUserRole';
import { useScheduledJobs, ScheduledJobStage } from '@/hooks/tracker/useScheduledJobs';
import { FinishingViewModeToggle, FinishingViewMode } from './FinishingViewModeToggle';
import { SingleStageFinishingView } from './SingleStageFinishingView';
import { MultiStageFinishingView } from './MultiStageFinishingView';
import { EnhancedJobDetailsModal } from './EnhancedJobDetailsModal';
import { GlobalBarcodeListener } from './GlobalBarcodeListener';
import { SupervisorOverrideModal } from './SupervisorOverrideModal';
import { FINISHING_STAGE_NAMES } from './FinishingStagePresets';
import { useConcurrentJobManagement } from '@/hooks/tracker/useConcurrentJobManagement';
import { AccessibleJob } from '@/hooks/tracker/useAccessibleJobs';
import { toast } from 'sonner';

const STORAGE_KEY = 'finishing_dashboard_prefs_v1';

interface FinishingDashboardPreferences {
  viewMode: FinishingViewMode;
  displayMode: 'card' | 'list';
  lastSelectedStage: string | undefined;
  selectedStageIds: string[];
}

export const EnhancedFinishingDashboard = () => {
  const { user, signOut } = useAuth();
  const { accessibleStages, isLoading: rolesLoading } = useUserRole();
  
  // Load preferences from localStorage
  const [viewMode, setViewMode] = useState<FinishingViewMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const prefs: FinishingDashboardPreferences = JSON.parse(saved);
        return prefs.viewMode || 'single-stage';
      }
    } catch (e) {
      console.error('Failed to load preferences:', e);
    }
    return 'single-stage';
  });

  const [selectedStageIds, setSelectedStageIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const prefs: FinishingDashboardPreferences = JSON.parse(saved);
        return prefs.selectedStageIds || [];
      }
    } catch (e) {
      console.error('Failed to load stage selection:', e);
    }
    return [];
  });

  const [selectedPrinterId, setSelectedPrinterId] = useState<string | undefined>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const prefs: FinishingDashboardPreferences = JSON.parse(saved);
        return prefs.lastSelectedStage;
      }
    } catch (e) {
      console.error('Failed to load stage:', e);
    }
    return undefined;
  });

  const [selectedPrinterInfo, setSelectedPrinterInfo] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedJobForDetails, setSelectedJobForDetails] = useState<any>(null);
  const [showJobDetailsModal, setShowJobDetailsModal] = useState(false);
  const [scanCompleted, setScanCompleted] = useState(false);
  const [supervisorOverrideJob, setSupervisorOverrideJob] = useState<any>(null);

  // Filter finishing stages from accessible stages
  const finishingStages = useMemo(() => {
    return accessibleStages
      .filter(stage => FINISHING_STAGE_NAMES.includes(stage.stage_name))
      .map(stage => ({
        id: stage.stage_id,
        name: stage.stage_name
      }));
  }, [accessibleStages]);

  // Fetch data based on view mode
  const scheduledJobsOptions = useMemo(() => ({
    production_stage_id: viewMode === 'single-stage' ? selectedPrinterId : undefined
  }), [viewMode, selectedPrinterId]);

  const { 
    scheduledJobs, 
    jobsByReadiness, 
    isLoading: scheduledLoading, 
    error: scheduledError,
    startScheduledJob, 
    completeScheduledJob, 
    refreshJobs: refreshScheduledJobs,
    lastUpdate
  } = useScheduledJobs(scheduledJobsOptions);

  const { 
    jobs: accessibleJobs, 
    isLoading: accessibleLoading, 
    error: accessibleError,
    refreshJobs: refreshAccessibleJobs
  } = useAccessibleJobs({
    permissionType: 'manage'
  });

  const { startJob, completeJob } = useJobActions(refreshAccessibleJobs);

  const {
    startJobOutOfOrder,
    loadDepartmentRules
  } = useConcurrentJobManagement();

  // Load department rules on mount
  useEffect(() => {
    loadDepartmentRules();
  }, [loadDepartmentRules]);

  // Save preferences to localStorage
  useEffect(() => {
    try {
      const prefs: FinishingDashboardPreferences = {
        viewMode,
        displayMode: 'card',
        lastSelectedStage: selectedPrinterId,
        selectedStageIds
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {
      console.error('Failed to save preferences:', e);
    }
  }, [viewMode, selectedPrinterId, selectedStageIds]);

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('❌ Logout failed:', error);
      toast.error('Logout failed');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (viewMode === 'single-stage') {
        await refreshScheduledJobs();
      } else {
        await refreshAccessibleJobs();
      }
      toast.success('Queue refreshed');
    } catch (error) {
      console.error('❌ Refresh failed:', error);
      toast.error('Failed to refresh queue');
    } finally {
      setTimeout(() => setRefreshing(false), 1000);
    }
  };

  const handleViewModeChange = (mode: FinishingViewMode) => {
    setViewMode(mode);
    if (mode === 'multi-stage' && selectedStageIds.length === 0) {
      // Set default to all finishing stages
      setSelectedStageIds(finishingStages.map(s => s.id));
    }
  };

  const handlePrinterChange = (printerId: string | undefined, printerInfo: any) => {
    setSelectedPrinterId(printerId);
    setSelectedPrinterInfo(printerInfo);
  };

  const handleJobClick = (job: any) => {
    setSelectedJobForDetails(job);
    setShowJobDetailsModal(true);
    setScanCompleted(false);
  };

  const handleStartJobFromModal = async (jobId: string): Promise<boolean> => {
    if (viewMode === 'single-stage') {
      const success = await startScheduledJob(jobId);
      if (success) {
        setShowJobDetailsModal(false);
        setScanCompleted(false);
        refreshScheduledJobs();
      }
      return success;
    } else {
      const job = accessibleJobs.find(j => j.job_id === jobId);
      if (job && job.current_stage_id) {
        const success = await startJob(jobId, job.current_stage_id);
        if (success) {
          setShowJobDetailsModal(false);
          setScanCompleted(false);
          refreshAccessibleJobs();
        }
        return success;
      }
      return false;
    }
  };

  const handleCompleteJobFromModal = async (jobId: string): Promise<boolean> => {
    if (viewMode === 'single-stage') {
      const success = await completeScheduledJob(jobId);
      if (success) {
        setShowJobDetailsModal(false);
        setScanCompleted(false);
        refreshScheduledJobs();
      }
      return success;
    } else {
      const job = accessibleJobs.find(j => j.job_id === jobId);
      if (job && job.current_stage_id) {
        const success = await completeJob(jobId, job.current_stage_id);
        if (success) {
          setShowJobDetailsModal(false);
          setScanCompleted(false);
          refreshAccessibleJobs();
        }
        return success;
      }
      return false;
    }
  };

  const handleSupervisorOverride = (job: any) => {
    setSupervisorOverrideJob(job);
  };

  const handleApplySupervisorOverride = async (override: {
    supervisorId: string;
    reason: string;
    overrideType: 'queue_order' | 'dependency' | 'schedule';
  }) => {
    if (supervisorOverrideJob) {
      const success = await startJobOutOfOrder(supervisorOverrideJob, override);
      if (success) {
        setSupervisorOverrideJob(null);
        if (viewMode === 'single-stage') {
          refreshScheduledJobs();
        } else {
          refreshAccessibleJobs();
        }
      }
    }
  };

  const handleBarcodeDetected = (barcodeData: string) => {
    if (!selectedJobForDetails) return;
    
    const normalize = (s: string) => (s || "").toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const stripLetters = (s: string) => s.replace(/^[A-Z]+/, "");

    const cleanScanned = normalize(barcodeData);
    const cleanExpected = normalize(selectedJobForDetails.wo_no);
    const numericScanned = stripLetters(cleanScanned);
    const numericExpected = stripLetters(cleanExpected);

    const isValid =
      cleanScanned === cleanExpected ||
      numericScanned === numericExpected ||
      cleanScanned.includes(cleanExpected) ||
      cleanExpected.includes(cleanScanned) ||
      numericScanned.includes(numericExpected) ||
      numericExpected.includes(numericScanned);
    
    if (isValid) {
      setScanCompleted(true);
      toast.success("Job barcode matched");
    } else {
      toast.error(`Scanned code does not match this job. Expected: ${selectedJobForDetails.wo_no}, Got: ${barcodeData}`);
    }
  };

  // Multi-stage specific handlers
  const openModalForStart = async (jobId: string, stageId: string): Promise<boolean> => {
    const jobToOpen = accessibleJobs.find(j => j.job_id === jobId);
    if (jobToOpen) {
      setSelectedJobForDetails(jobToOpen);
      setShowJobDetailsModal(true);
      setScanCompleted(false);
    }
    return true;
  };

  const openModalForComplete = async (jobId: string, stageId: string): Promise<boolean> => {
    const jobToOpen = accessibleJobs.find(j => j.job_id === jobId);
    if (jobToOpen) {
      setSelectedJobForDetails(jobToOpen);
      setShowJobDetailsModal(true);
      setScanCompleted(false);
    }
    return true;
  };

  const isLoading = rolesLoading || (viewMode === 'single-stage' ? scheduledLoading : accessibleLoading);
  const error = viewMode === 'single-stage' ? scheduledError : accessibleError;

  // Show loading only if we have necessary data loading
  if (isLoading && !finishingStages.length) {
    return (
      <div className="flex items-center justify-center p-8 min-h-screen bg-gray-50">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
          <span className="text-xl font-medium text-gray-900">Loading finishing dashboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 min-h-screen bg-gray-50">
        <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-lg max-w-2xl mx-auto mt-20">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <p className="font-semibold text-xl">Error Loading Jobs</p>
            <p className="mt-2">{error}</p>
            <Button onClick={handleRefresh} className="mt-4" variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Global Barcode Listener */}
      {showJobDetailsModal && selectedJobForDetails && (
        <GlobalBarcodeListener onBarcodeDetected={handleBarcodeDetected} minLength={5} />
      )}
      
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">Factory Floor - Finishing</h1>
                {viewMode === 'single-stage' && selectedPrinterInfo && (
                  <Badge variant="secondary" className="text-sm">
                    {selectedPrinterInfo.name}
                  </Badge>
                )}
              </div>
              <p className="text-gray-600">
                Welcome back, {user?.email?.split('@')[0] || 'Operator'}
              </p>
              {viewMode === 'single-stage' && (
                <p className="text-xs text-gray-500 mt-1">
                  Last updated: {lastUpdate.toLocaleTimeString()}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <FinishingViewModeToggle
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
              />
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              
              <Button
                variant="outline" 
                size="sm"
                onClick={handleLogout}
              >
                <Users className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {viewMode === 'single-stage' ? (
          <SingleStageFinishingView
            selectedPrinterId={selectedPrinterId}
            selectedPrinterInfo={selectedPrinterInfo}
            scheduledJobs={scheduledJobs}
            jobsByReadiness={jobsByReadiness}
            isLoading={scheduledLoading}
            onPrinterChange={handlePrinterChange}
            onJobClick={handleJobClick}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            userName={user?.email?.split('@')[0] || 'Operator'}
            lastUpdate={lastUpdate}
          />
        ) : (
          <MultiStageFinishingView
            availableStages={finishingStages}
            selectedStageIds={selectedStageIds}
            jobs={accessibleJobs}
            onStageSelectionChange={setSelectedStageIds}
            onJobClick={handleJobClick}
            onStart={openModalForStart}
            onComplete={openModalForComplete}
          />
        )}
      </div>

      {/* Job Details Modal */}
      {selectedJobForDetails && (
        <EnhancedJobDetailsModal
          job={selectedJobForDetails}
          isOpen={showJobDetailsModal}
          onClose={() => {
            setShowJobDetailsModal(false);
            setSelectedJobForDetails(null);
            setScanCompleted(false);
          }}
          onStartJob={handleStartJobFromModal}
          onCompleteJob={handleCompleteJobFromModal}
          scanCompleted={scanCompleted}
        />
      )}

      {/* Supervisor Override Modal */}
      {supervisorOverrideJob && (
        <SupervisorOverrideModal
          isOpen={!!supervisorOverrideJob}
          onClose={() => setSupervisorOverrideJob(null)}
          job={supervisorOverrideJob}
          onApprove={handleApplySupervisorOverride}
        />
      )}
    </div>
  );
};
