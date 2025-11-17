import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Scissors, FoldVertical, Repeat, Maximize, PenTool, Zap } from 'lucide-react';
import { ViewToggle } from '../common/ViewToggle';
import { DtpKanbanColumnWithBoundary } from './DtpKanbanColumnWithBoundary';
import { EnhancedJobDetailsModal } from './EnhancedJobDetailsModal';
import { JobListView } from '../common/JobListView';
import { useAccessibleJobs, AccessibleJob } from '@/hooks/tracker/useAccessibleJobs';
import { ScheduledJobStage } from '@/hooks/tracker/useScheduledJobs';
import { useJobActions } from '@/hooks/tracker/useAccessibleJobs/useJobActions';
import { JobListLoading, JobErrorState } from '../common/JobLoadingStates';
import { ScoringQueueToggleControls } from './ScoringQueueToggleControls';
import { ScrollArea } from '@/components/ui/scroll-area';

interface QueueConfig {
  id: string;
  title: string;
  stageName: string;
  colorClass: string;
  icon: React.ReactNode;
}

const QUEUE_CONFIGS: QueueConfig[] = [
  { id: 'scoring', title: 'Scoring', stageName: 'Scoring', colorClass: 'bg-purple-600', icon: <Scissors className="h-4 w-4" /> },
  { id: 'scoring_folding', title: 'Scoring & Folding', stageName: 'Scoring & Folding', colorClass: 'bg-indigo-600', icon: <FoldVertical className="h-4 w-4" /> },
  { id: 'perfing', title: 'Perfing', stageName: 'Perfing', colorClass: 'bg-violet-600', icon: <Repeat className="h-4 w-4" /> },
  { id: 'creasing', title: 'Creasing', stageName: 'Creasing', colorClass: 'bg-fuchsia-600', icon: <Maximize className="h-4 w-4" /> },
  { id: 'manual_folding', title: 'Manual Folding', stageName: 'Manual Folding', colorClass: 'bg-pink-600', icon: <PenTool className="h-4 w-4" /> },
  { id: 'auto_folding', title: 'Auto Folding', stageName: 'Auto Folding', colorClass: 'bg-rose-600', icon: <Zap className="h-4 w-4" /> }
];

export const ScoringKanbanDashboard: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'list'>(() => {
    const saved = localStorage.getItem('scoring-view-mode');
    return (saved === 'card' || saved === 'list') ? saved : 'card';
  });
  const [selectedJob, setSelectedJob] = useState<AccessibleJob | null>(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [enabledStageNames, setEnabledStageNames] = useState<string[]>([]);

  const { jobs, isLoading, error, refreshJobs } = useAccessibleJobs({
    permissionType: 'view'
  });

  const { startJob, completeJob } = useJobActions(refreshJobs);

  const handleViewModeChange = (mode: 'card' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('scoring-view-mode', mode);
  };

  const handleRefresh = async () => {
    await refreshJobs();
  };

  const handleJobClick = (job: AccessibleJob) => {
    setSelectedJob(job);
    setShowJobModal(true);
  };

  const handleCloseModal = () => {
    setShowJobModal(false);
    setSelectedJob(null);
  };

  // Convert AccessibleJob to ScheduledJobStage for EnhancedJobDetailsModal
  const convertToScheduledJobStage = (job: AccessibleJob): ScheduledJobStage => {
    return {
      id: job.current_stage_id || job.job_id,
      job_id: job.job_id,
      job_table_name: 'production_jobs',
      production_stage_id: job.current_stage_id || '',
      stage_name: job.current_stage_name,
      stage_color: job.current_stage_color,
      stage_order: job.current_stage_order || 0,
      status: job.current_stage_status as any,
      wo_no: job.wo_no,
      customer: job.customer,
      due_date: job.due_date,
      qty: job.qty,
      category_name: job.category_name,
      category_color: job.category_color,
      is_ready_now: true,
      is_scheduled_later: false,
      is_waiting_for_dependencies: false,
    };
  };

  // Wrapper functions for start/complete that handle stageId
  const handleStartJobWrapper = async (jobId: string): Promise<boolean> => {
    const job = jobs.find(j => j.job_id === jobId);
    if (!job || !job.current_stage_id) return false;
    
    const result = await startJob(jobId, job.current_stage_id);
    if (result) {
      await refreshJobs();
    }
    return result;
  };

  const handleCompleteJobWrapper = async (jobId: string): Promise<boolean> => {
    const job = jobs.find(j => j.job_id === jobId);
    if (!job || !job.current_stage_id) return false;
    
    const result = await completeJob(jobId, job.current_stage_id);
    if (result) {
      await refreshJobs();
    }
    return result;
  };

  // Filter jobs by search and queue
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesSearch = !searchQuery || 
        job.wo_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.customer.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesSearch;
    });
  }, [jobs, searchQuery]);

  // Organize jobs by queue
  const queueJobs = useMemo(() => {
    const queues: Record<string, AccessibleJob[]> = {};
    
    QUEUE_CONFIGS.forEach(config => {
      queues[config.id] = filteredJobs.filter(job => 
        job.current_stage_name.toLowerCase().includes(config.stageName.toLowerCase())
      );
    });
    
    return queues;
  }, [filteredJobs]);

  // Count total jobs and queue groups
  const totalJobs = filteredJobs.length;
  const activeQueueCount = QUEUE_CONFIGS.filter(config => 
    (queueJobs[config.id]?.length || 0) > 0
  ).length;

  if (isLoading) {
    return <JobListLoading />;
  }

  if (error) {
    return <JobErrorState error={error} onRetry={handleRefresh} onRefresh={refreshJobs} />;
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 p-3 sm:p-4 border-b bg-card">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <ViewToggle view={viewMode} onViewChange={handleViewModeChange} />
            
            <ScoringQueueToggleControls 
              onQueueFiltersChange={setEnabledStageNames}
            />
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="whitespace-nowrap">
                {totalJobs} Jobs
              </Badge>
              <Badge variant="outline" className="whitespace-nowrap">
                {activeQueueCount} Queues
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Card or List View */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'card' ? (
          <div key="card-view" className="overflow-x-auto pb-4 h-full">
            <div className="flex gap-4 min-w-max p-4">
              {QUEUE_CONFIGS.map(config => {
                if (!enabledStageNames.includes(config.stageName) && enabledStageNames.length > 0) {
                  return null;
                }

                const jobsForQueue = queueJobs[config.id] || [];
                
                return (
                  <div key={config.id} className="w-80 flex-shrink-0">
                    <DtpKanbanColumnWithBoundary
                      title={config.title}
                      jobs={jobsForQueue}
                      onStart={startJob}
                      onComplete={completeJob}
                      onJobClick={handleJobClick}
                      colorClass={config.colorClass}
                      icon={config.icon}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div key="list-view" className="overflow-x-auto pb-4 h-full">
            <div className="flex gap-4 min-w-max">
              {QUEUE_CONFIGS.map(config => {
                if (!enabledStageNames.includes(config.stageName) && enabledStageNames.length > 0) {
                  return null;
                }

                const jobsForQueue = queueJobs[config.id] || [];
                
                return (
                  <div key={config.id} className="w-80 flex-shrink-0 flex flex-col space-y-2">
                    <div className={`flex-shrink-0 px-3 py-2 ${config.colorClass} text-white rounded-md`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {config.icon}
                          <span className="font-medium text-sm truncate">{config.title} ({jobsForQueue.length})</span>
                        </div>
                        <span className="text-xs opacity-80">Sorted by: Priority</span>
                      </div>
                    </div>
                    <ScrollArea className="flex-1">
                      <div className="pr-4">
                        <JobListView
                          jobs={jobsForQueue}
                          onStart={startJob}
                          onComplete={completeJob}
                          onJobClick={handleJobClick}
                        />
                      </div>
                    </ScrollArea>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Job Details Modal */}
      {selectedJob && (
        <EnhancedJobDetailsModal
          job={convertToScheduledJobStage(selectedJob)}
          isOpen={showJobModal}
          onClose={handleCloseModal}
          onStartJob={handleStartJobWrapper}
          onCompleteJob={handleCompleteJobWrapper}
        />
      )}
    </div>
  );
};
