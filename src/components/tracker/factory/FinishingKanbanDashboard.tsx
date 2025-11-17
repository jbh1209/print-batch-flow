import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Hand, Layers, Circle, Package, FolderOpen, Book } from 'lucide-react';
import { ViewToggle } from '../common/ViewToggle';
import { DtpKanbanColumnWithBoundary } from './DtpKanbanColumnWithBoundary';
import { DtpJobModal } from './DtpJobModal';
import { useAccessibleJobs, AccessibleJob } from '@/hooks/tracker/useAccessibleJobs';
import { useJobActions } from '@/hooks/tracker/useAccessibleJobs/useJobActions';
import { JobListLoading, JobErrorState } from '../common/JobLoadingStates';
import { FinishingQueueToggleControls } from './FinishingQueueToggleControls';

interface QueueConfig {
  id: string;
  title: string;
  stageName: string;
  colorClass: string;
  icon: React.ReactNode;
}

const QUEUE_CONFIGS: QueueConfig[] = [
  { id: 'handwork', title: 'Handwork', stageName: 'Handwork', colorClass: 'bg-orange-600', icon: <Hand className="h-4 w-4" /> },
  { id: 'padding', title: 'Padding', stageName: 'Padding', colorClass: 'bg-amber-600', icon: <Layers className="h-4 w-4" /> },
  { id: 'round_corners', title: 'Round Corners', stageName: 'Round Corners', colorClass: 'bg-yellow-600', icon: <Circle className="h-4 w-4" /> },
  { id: 'box_gluing', title: 'Box Gluing', stageName: 'Box Gluing', colorClass: 'bg-teal-600', icon: <Package className="h-4 w-4" /> },
  { id: 'gathering', title: 'Gathering', stageName: 'Gathering', colorClass: 'bg-cyan-600', icon: <FolderOpen className="h-4 w-4" /> },
  { id: 'wire_binding', title: 'Wire Binding', stageName: 'Wire Binding', colorClass: 'bg-blue-600', icon: <Book className="h-4 w-4" /> }
];

export const FinishingKanbanDashboard: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [selectedJob, setSelectedJob] = useState<AccessibleJob | null>(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [enabledStageNames, setEnabledStageNames] = useState<string[]>([]);

  const { jobs, isLoading, error, refreshJobs } = useAccessibleJobs({
    permissionType: 'view'
  });

  const { startJob, completeJob } = useJobActions(refreshJobs);

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

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const stageName = job.current_stage_name || '';
      const matchesQueue = enabledStageNames.length === 0 || enabledStageNames.includes(stageName);
      const matchesSearch = searchQuery === '' ||
        job.wo_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.reference.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesQueue && matchesSearch;
    });
  }, [jobs, enabledStageNames, searchQuery]);

  const queueJobs = useMemo(() => {
    return QUEUE_CONFIGS.reduce((acc, config) => {
      acc[config.id] = filteredJobs.filter(job =>
        job.current_stage_name === config.stageName
      );
      return acc;
    }, {} as Record<string, AccessibleJob[]>);
  }, [filteredJobs]);

  const totalJobs = filteredJobs.length;
  const activeJobs = filteredJobs.filter(job => job.current_stage_status === 'active').length;
  const enabledCount = enabledStageNames.length || QUEUE_CONFIGS.length;

  if (isLoading) {
    return <JobListLoading />;
  }

  if (error) {
    return <JobErrorState error={error} onRetry={handleRefresh} onRefresh={refreshJobs} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-2xl font-bold">Finishing Department</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <Input
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
          <div className="relative">
            <FinishingQueueToggleControls onQueueFiltersChange={setEnabledStageNames} />
          </div>
          <ViewToggle view={viewMode} onViewChange={setViewMode} />
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Badge variant="secondary">Total: {totalJobs}</Badge>
        <Badge variant="secondary">Active: {activeJobs}</Badge>
        <Badge variant="secondary">Enabled Queues: {enabledCount}</Badge>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {QUEUE_CONFIGS.map(config => {
            if (!enabledStageNames.includes(config.stageName) && enabledStageNames.length > 0) {
              return null;
            }

            return (
              <div key={config.id} className="w-80 flex-shrink-0">
                <DtpKanbanColumnWithBoundary
                  title={config.title}
                  jobs={queueJobs[config.id] || []}
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

      {selectedJob && (
        <DtpJobModal
          job={selectedJob}
          isOpen={showJobModal}
          onClose={handleCloseModal}
          onStart={startJob}
          onComplete={completeJob}
        />
      )}
    </div>
  );
};
