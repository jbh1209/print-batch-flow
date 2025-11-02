import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, Info, RefreshCw } from 'lucide-react';
import { FinishingStageSelector } from './FinishingStageSelector';
import { EnhancedScheduledOperatorJobCard } from './EnhancedScheduledOperatorJobCard';
import { useScheduledJobs, ScheduledJobStage } from '@/hooks/tracker/useScheduledJobs';

interface MultiStageFinishingViewProps {
  availableStages: Array<{ id: string; name: string }>;
  selectedStageIds: string[];
  onStageSelectionChange: (stageIds: string[]) => void;
  onJobClick: (job: ScheduledJobStage) => void;
}

export const MultiStageFinishingView: React.FC<MultiStageFinishingViewProps> = ({
  availableStages,
  selectedStageIds,
  onStageSelectionChange,
  onJobClick
}) => {
  // Fetch all scheduled jobs across finishing stages
  const { scheduledJobs, isLoading, error, refreshJobs } = useScheduledJobs({ 
    include_all_stages: true 
  });

  // Filter and group jobs by selected stages
  const jobsByStage = useMemo(() => {
    const stageMap: Record<string, ScheduledJobStage[]> = {};
    
    selectedStageIds.forEach(stageId => {
      // Filter jobs for this stage
      const stageJobs = scheduledJobs.filter(job => 
        job.production_stage_id === stageId
      );

      // Sort by scheduling priority
      const sorted = stageJobs.sort((a, b) => {
        // 1. Active jobs first
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (b.status === 'active' && a.status !== 'active') return 1;

        // 2. Scheduled start time (nulls last)
        if (a.scheduled_start_at && !b.scheduled_start_at) return -1;
        if (!a.scheduled_start_at && b.scheduled_start_at) return 1;
        if (a.scheduled_start_at && b.scheduled_start_at) {
          const timeCompare = new Date(a.scheduled_start_at).getTime() - new Date(b.scheduled_start_at).getTime();
          if (timeCompare !== 0) return timeCompare;
        }

        // 3. Queue position (nulls last)
        if (a.queue_position !== undefined && b.queue_position === undefined) return -1;
        if (a.queue_position === undefined && b.queue_position !== undefined) return 1;
        if (a.queue_position !== undefined && b.queue_position !== undefined) {
          const queueCompare = a.queue_position - b.queue_position;
          if (queueCompare !== 0) return queueCompare;
        }

        // 4. Stage order
        return a.stage_order - b.stage_order;
      });

      stageMap[stageId] = sorted;
      console.info(`[Multi-Stage Kanban] ${availableStages.find(s => s.id === stageId)?.name || stageId}: ${sorted.length} jobs`);
    });
    
    return stageMap;
  }, [scheduledJobs, selectedStageIds, availableStages]);

  // Calculate aggregate stats across selected stages
  const stats = useMemo(() => {
    const uniqueJobs = new Map<string, ScheduledJobStage>();
    
    selectedStageIds.forEach(stageId => {
      (jobsByStage[stageId] || []).forEach(job => {
        uniqueJobs.set(job.job_id, job);
      });
    });
    
    const allJobs = Array.from(uniqueJobs.values());
    const totalJobs = allJobs.length;
    const activeCount = allJobs.filter(j => j.status === 'active').length;
    const readyCount = allJobs.filter(j => j.is_ready_now && j.status === 'pending').length;
    const waitingCount = allJobs.filter(j => j.is_waiting_for_dependencies).length;
    
    return { totalJobs, activeCount, readyCount, waitingCount };
  }, [jobsByStage, selectedStageIds]);

  console.info('[Multi-Stage Kanban] Total scheduled jobs fetched:', scheduledJobs.length);
  console.info('[Multi-Stage Kanban] Stats:', stats);

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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <FinishingStageSelector
          availableStages={availableStages}
          selectedStageIds={selectedStageIds}
          onSelectionChange={onStageSelectionChange}
        />
        <Card>
          <CardContent className="p-12 text-center">
            <RefreshCw className="h-12 w-12 mx-auto mb-4 text-blue-500 animate-spin" />
            <p className="text-gray-600">Loading jobs...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <FinishingStageSelector
          availableStages={availableStages}
          selectedStageIds={selectedStageIds}
          onSelectionChange={onStageSelectionChange}
        />
        <Card>
          <CardContent className="p-12 text-center">
            <Info className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <p className="text-red-600 font-semibold mb-2">Error Loading Jobs</p>
            <p className="text-gray-600">{error}</p>
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
              <Card className="h-full">
                {/* Column Header */}
                <div className="bg-purple-600 text-white p-3 flex items-center justify-between rounded-t-lg">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <span className="font-semibold">{stage.name}</span>
                  </div>
                  <Badge variant="secondary" className="bg-white/20 text-white">
                    {stageJobs.length}
                  </Badge>
                </div>

                {/* Column Body */}
                <CardContent className="p-3 space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
                  {stageJobs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No jobs in queue</p>
                    </div>
                  ) : (
                    stageJobs.map(job => (
                      <EnhancedScheduledOperatorJobCard
                        key={job.id}
                        job={job}
                        onClick={() => onJobClick(job)}
                        onRefresh={refreshJobs}
                        showActions={true}
                        compact={false}
                      />
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
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
