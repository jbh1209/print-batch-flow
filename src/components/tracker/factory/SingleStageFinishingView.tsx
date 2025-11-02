import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Timer, 
  RefreshCw, 
  CheckCircle, 
  Calendar, 
  Layers,
  UserCheck,
  Info
} from 'lucide-react';
import { PrinterQueueSelector } from './PrinterQueueSelector';
import { EnhancedScheduledOperatorJobCard } from './EnhancedScheduledOperatorJobCard';
import { OperatorJobListView } from './OperatorJobListView';
import { ViewToggle } from '../common/ViewToggle';
import { ConcurrentJobSelector } from './ConcurrentJobSelector';
import { BatchStartModal } from './BatchStartModal';
import { ScheduledJobStage } from '@/hooks/tracker/useScheduledJobs';
import { useConcurrentJobManagement } from '@/hooks/tracker/useConcurrentJobManagement';

interface SingleStageFinishingViewProps {
  selectedPrinterId: string | undefined;
  selectedPrinterInfo: any;
  scheduledJobs: ScheduledJobStage[];
  jobsByReadiness: any;
  isLoading: boolean;
  onPrinterChange: (printerId: string | undefined, printerInfo: any) => void;
  onJobClick: (job: ScheduledJobStage) => void;
  onRefresh: () => void;
  refreshing: boolean;
  userName: string;
  lastUpdate: Date;
}

export const SingleStageFinishingView: React.FC<SingleStageFinishingViewProps> = ({
  selectedPrinterId,
  selectedPrinterInfo,
  scheduledJobs,
  jobsByReadiness,
  isLoading,
  onPrinterChange,
  onJobClick,
  onRefresh,
  refreshing,
  userName,
  lastUpdate
}) => {
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [concurrentMode, setConcurrentMode] = useState(false);
  const [showBatchStartModal, setShowBatchStartModal] = useState(false);

  const {
    selectedJobs,
    isProcessing: concurrentProcessing,
    toggleJobSelection,
    clearSelection,
    startJobsBatch
  } = useConcurrentJobManagement();

  const stats = {
    total: scheduledJobs.length,
    readyNow: jobsByReadiness.ready_now.length,
    scheduledLater: jobsByReadiness.scheduled_later.length,
    waitingDependencies: jobsByReadiness.waiting_dependencies.length,
    active: scheduledJobs.filter((j: any) => j.status === 'active').length,
    selected: selectedJobs.length,
    compatible: selectedJobs.filter((j: any) => j.isCompatible).length
  };

  const handleJobClickWrapper = (job: ScheduledJobStage) => {
    if (concurrentMode) {
      toggleJobSelection(job);
    } else {
      onJobClick(job);
    }
  };

  const handleStartBatch = async (options: any) => {
    const success = await startJobsBatch(options.supervisorOverride);
    if (success) {
      setShowBatchStartModal(false);
      onRefresh();
    }
  };

  // Show selection prompt if no stage is selected
  if (!selectedPrinterId) {
    return (
      <div className="space-y-6">
        <PrinterQueueSelector
          selectedPrinterId={selectedPrinterId}
          onPrinterChange={onPrinterChange}
          jobStats={{
            ready: 0,
            scheduled: 0,
            waiting: 0,
            active: 0
          }}
        />
        
        <Card>
          <CardContent className="p-12 text-center">
            <Info className="h-16 w-16 mx-auto mb-4 text-blue-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Select Your Work Queue
            </h2>
            <p className="text-gray-600 mb-4">
              Please select which production stage you'd like to work on from the dropdown above.
            </p>
            <p className="text-sm text-gray-500">
              Your queue will load once you've made a selection.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Printer Queue Selector */}
      <PrinterQueueSelector
        selectedPrinterId={selectedPrinterId}
        onPrinterChange={onPrinterChange}
        jobStats={{
          ready: stats.readyNow,
          scheduled: stats.scheduledLater,
          waiting: stats.waitingDependencies,
          active: stats.active
        }}
      />

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700">Total Jobs</p>
                <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
              </div>
              <Timer className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700">Active Jobs</p>
                <p className="text-2xl font-bold text-purple-900">{stats.active}</p>
              </div>
              <RefreshCw className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">Ready to Work</p>
                <p className="text-2xl font-bold text-green-900">{stats.readyNow}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Waiting</p>
                <p className="text-2xl font-bold text-gray-900">{stats.waitingDependencies}</p>
              </div>
              <Calendar className="h-8 w-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>

        {/* Selected Jobs Stats (shown in concurrent mode) */}
        {concurrentMode && (
          <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-indigo-700">Selected</p>
                  <p className="text-2xl font-bold text-indigo-900">{stats.selected}</p>
                  {stats.selected > 0 && (
                    <p className="text-xs text-indigo-600">
                      {stats.compatible} compatible
                    </p>
                  )}
                </div>
                <Layers className="h-8 w-8 text-indigo-600" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* View Controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant={concurrentMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setConcurrentMode(!concurrentMode);
              if (concurrentMode) clearSelection();
            }}
          >
            <Layers className="h-4 w-4 mr-2" />
            {concurrentMode ? 'Exit Multi-Select' : 'Multi-Select'}
          </Button>
          
          {selectedJobs.length > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowBatchStartModal(true)}
              disabled={concurrentProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Start {selectedJobs.length} Jobs
            </Button>
          )}
        </div>

        {!concurrentMode && <ViewToggle view={viewMode} onViewChange={setViewMode} />}
      </div>

      {/* Multi-Select Mode */}
      {concurrentMode && (
        <ConcurrentJobSelector
          availableJobs={scheduledJobs}
          selectedJobs={selectedJobs}
          onToggleSelection={toggleJobSelection}
          onClearSelection={clearSelection}
          onStartBatch={() => setShowBatchStartModal(true)}
          onRequestSupervisorOverride={() => {}}
          isProcessing={concurrentProcessing}
          batchCompatibility={{
            compatible: selectedJobs.every(j => j.isCompatible),
            issues: []
          }}
        />
      )}

      {/* Jobs Display */}
      {!concurrentMode && (
        <>
          {viewMode === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scheduledJobs.map((job: any) => (
                <EnhancedScheduledOperatorJobCard
                  key={job.id}
                  job={job}
                  onClick={() => onJobClick(job)}
                />
              ))}
            </div>
          ) : (
            <OperatorJobListView
              jobs={scheduledJobs}
              onJobClick={onJobClick}
              onStartJob={async (jobId) => {
                onJobClick(scheduledJobs.find(j => j.id === jobId)!);
                return true;
              }}
              onCompleteJob={async (jobId) => {
                onJobClick(scheduledJobs.find(j => j.id === jobId)!);
                return true;
              }}
            />
          )}
        </>
      )}

      {scheduledJobs.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Info className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">No jobs found for this stage</p>
          </CardContent>
        </Card>
      )}

      {/* Batch Start Modal */}
      {showBatchStartModal && (
        <BatchStartModal
          isOpen={showBatchStartModal}
          onClose={() => setShowBatchStartModal(false)}
          selectedJobs={selectedJobs}
          batchCompatibility={{
            compatible: selectedJobs.every(j => j.isCompatible),
            issues: []
          }}
          onStartBatch={handleStartBatch}
        />
      )}
    </div>
  );
};
