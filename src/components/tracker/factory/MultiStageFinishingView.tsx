import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Settings, Info } from 'lucide-react';
import { DtpKanbanColumnWithBoundary } from './DtpKanbanColumnWithBoundary';
import { FinishingStageSelector } from './FinishingStageSelector';
import { AccessibleJob } from '@/hooks/tracker/useAccessibleJobs';
import { sortJobsByWorkflowPriority } from '@/utils/tracker/workflowStateUtils';
import { shouldJobAppearInWorkflowStage } from '@/utils/productionWorkflowUtils';

interface MultiStageFinishingViewProps {
  availableStages: Array<{ id: string; name: string }>;
  selectedStageIds: string[];
  jobs: AccessibleJob[];
  onStageSelectionChange: (stageIds: string[]) => void;
  onJobClick: (job: AccessibleJob) => void;
  onStart: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete: (jobId: string, stageId: string) => Promise<boolean>;
}

export const MultiStageFinishingView: React.FC<MultiStageFinishingViewProps> = ({
  availableStages,
  selectedStageIds,
  jobs,
  onStageSelectionChange,
  onJobClick,
  onStart,
  onComplete
}) => {
  // Calculate aggregate stats
  // Stats computed after jobsByStage to reflect selected columns


  // Organize jobs by stage
  const jobsByStage = useMemo(() => {
    const stageMap: Record<string, AccessibleJob[]> = {};
    
    selectedStageIds.forEach(stageId => {
      const stageJobs = jobs.filter(job => {
        if (job.status === 'completed' || job.status === 'cancelled') return false;
        const matchesCurrent = job.current_stage_id === stageId;

        let appearsInWorkflow = false;
        try {
          const workflowStages = Array.isArray((job as any).parallel_stages) ? (job as any).parallel_stages : [];
          appearsInWorkflow = shouldJobAppearInWorkflowStage(workflowStages, stageId);
        } catch {
          appearsInWorkflow = false;
        }

        const matchesParallel = Array.isArray(job.parallel_stages) && job.parallel_stages.some(ps => ps.stage_id === stageId);

        return matchesCurrent || appearsInWorkflow || matchesParallel;
      });

      const sorted = sortJobsByWorkflowPriority(stageJobs);
      // Debug: verify counts per column
      try {
        const stageName = availableStages?.find(s => s.id === stageId)?.name || stageId;
        console.info('[Finishing Kanban] Column %s (%s) jobs: %d', stageName, stageId, sorted.length);
      } catch {}
      stageMap[stageId] = sorted;
    });
    
    return stageMap;
  }, [jobs, selectedStageIds]);

  const stats = useMemo(() => {
    const unique = new Map<string, AccessibleJob>();
    selectedStageIds.forEach(id => {
      (jobsByStage[id] || []).forEach(j => unique.set((j.id || j.job_id), j));
    });
    const all = Array.from(unique.values());
    const totalJobs = all.length;
    let activeCount = 0, readyCount = 0, waitingCount = 0;
    all.forEach(j => {
      const status = (j.current_stage_status || j.status || '').toLowerCase();
      if (status === 'active') activeCount++;
      else if (status === 'ready') readyCount++;
      else if (status === 'pending' || status === 'waiting' || status === 'on_hold') waitingCount++;
    });
    return { totalJobs, activeCount, readyCount, waitingCount };
  }, [jobsByStage, selectedStageIds]);

  if (selectedStageIds.length === 0) {
    return (
      <div className="space-y-4">
        <FinishingStageSelector
          availableStages={availableStages}
          selectedStageIds={selectedStageIds}
          onSelectionChange={onStageSelectionChange}
        />
        
        <Card>
          <CardContent className="p-12 text-center">
            <Info className="h-16 w-16 mx-auto mb-4 text-purple-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Select Stages to View
            </h2>
            <p className="text-gray-600 mb-4">
              Choose one or more finishing stages to see jobs in multi-column view.
            </p>
            <p className="text-sm text-gray-500">
              Use the preset options for quick selection or customize your view.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stage Selector */}
      <FinishingStageSelector
        availableStages={availableStages}
        selectedStageIds={selectedStageIds}
        onSelectionChange={onStageSelectionChange}
      />

      {/* Aggregate Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-blue-700">Total Jobs</p>
            <p className="text-xl font-bold text-blue-900">{stats.totalJobs}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-purple-700">Active</p>
            <p className="text-xl font-bold text-purple-900">{stats.activeCount}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-green-700">Ready</p>
            <p className="text-xl font-bold text-green-900">{stats.readyCount}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-gray-700">Waiting</p>
            <p className="text-xl font-bold text-gray-900">{stats.waitingCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Multi-Column Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {selectedStageIds.map(stageId => {
          const stage = availableStages.find(s => s.id === stageId);
          if (!stage) return null;
          
          const stageJobs = jobsByStage[stageId] || [];

          return (
            <div key={stageId} className="min-w-[320px] max-w-[380px] flex-shrink-0">
              <DtpKanbanColumnWithBoundary
                title={stage.name}
                jobs={stageJobs}
                onStart={onStart}
                onComplete={onComplete}
                onJobClick={onJobClick}
                colorClass="bg-purple-600"
                icon={<Settings className="h-4 w-4" />}
              />
            </div>
          );
        })}
      </div>

      {Object.values(jobsByStage).every(jobs => jobs.length === 0) && (
        <Card>
          <CardContent className="p-8 text-center">
            <Info className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">No active jobs found in selected stages</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
