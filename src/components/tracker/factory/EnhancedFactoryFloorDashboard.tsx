
import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Settings, Eye, EyeOff, Grid3X3, Grid2X2, MoreHorizontal } from "lucide-react";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useUserStagePermissions } from "@/hooks/tracker/useUserStagePermissions";
import { ViewToggle } from "@/components/tracker/common/ViewToggle";
import { StageKanbanColumn } from "./StageKanbanColumn";
import { ColumnVisibilityControls } from "./ColumnVisibilityControls";
import { processJobStatus, isJobOverdue, isJobDueSoon } from "@/hooks/tracker/useAccessibleJobs/jobStatusProcessor";

export const EnhancedFactoryFloorDashboard: React.FC = () => {
  const { jobs, isLoading, error, startJob, completeJob, refreshJobs } = useAccessibleJobs({
    permissionType: 'work'
  });
  const { consolidatedStages } = useUserStagePermissions();
  
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [visibleStageIds, setVisibleStageIds] = useState<Set<string>>(new Set());
  const [layout, setLayout] = useState<'2-col' | '3-col' | '4-col'>('3-col');

  // Initialize visible stages with stages that have jobs
  React.useEffect(() => {
    if (consolidatedStages.length > 0 && visibleStageIds.size === 0) {
      const stagesWithJobs = consolidatedStages.filter(stage => 
        jobs.some(job => job.current_stage_id === stage.stage_id)
      );
      const initialVisible = stagesWithJobs.slice(0, 3).map(s => s.stage_id);
      setVisibleStageIds(new Set(initialVisible));
    }
  }, [consolidatedStages, jobs, visibleStageIds.size]);

  // Group jobs by current stage
  const jobsByStage = useMemo(() => {
    const grouped: Record<string, typeof jobs> = {};
    
    jobs.forEach(job => {
      const stageId = job.current_stage_id;
      if (stageId) {
        if (!grouped[stageId]) {
          grouped[stageId] = [];
        }
        grouped[stageId].push(job);
      }
    });
    
    return grouped;
  }, [jobs]);

  // Get statistics
  const stats = useMemo(() => {
    const totalJobs = jobs.length;
    const activeJobs = jobs.filter(job => job.current_stage_status === 'active').length;
    const pendingJobs = jobs.filter(job => job.current_stage_status === 'pending').length;
    const overdueJobs = jobs.filter(job => isJobOverdue(job)).length;
    const dueSoonJobs = jobs.filter(job => isJobDueSoon(job)).length;
    
    return { totalJobs, activeJobs, pendingJobs, overdueJobs, dueSoonJobs };
  }, [jobs]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshJobs();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleStageVisibilityToggle = (stageId: string) => {
    const newVisible = new Set(visibleStageIds);
    if (newVisible.has(stageId)) {
      newVisible.delete(stageId);
    } else {
      newVisible.add(stageId);
    }
    setVisibleStageIds(newVisible);
  };

  const visibleStages = consolidatedStages.filter(stage => 
    visibleStageIds.has(stage.stage_id) && stage.can_work
  );

  const getLayoutColumns = () => {
    switch (layout) {
      case '2-col': return 'grid-cols-1 md:grid-cols-2';
      case '3-col': return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      case '4-col': return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
      default: return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading factory floor...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex flex-col items-center justify-center p-6">
            <h2 className="text-lg font-semibold mb-1 text-red-700">Error Loading Factory Floor</h2>
            <p className="text-red-600 text-center mb-2">{error}</p>
            <Button onClick={handleRefresh} variant="outline" size="sm">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Enhanced Factory Floor</h1>
          <p className="text-gray-600">Multi-stage production workflow dashboard</p>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
            <span>{stats.totalJobs} total jobs</span>
            <span>{visibleStages.length} visible stages</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <ColumnVisibilityControls
            stages={consolidatedStages.filter(s => s.can_work)}
            visibleStageIds={visibleStageIds}
            onToggleStage={handleStageVisibilityToggle}
            layout={layout}
            onLayoutChange={setLayout}
          />
          <ViewToggle view={viewMode} onViewChange={setViewMode} />
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={refreshing}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="text-center">
              <p className="text-2xl font-bold">{stats.totalJobs}</p>
              <p className="text-xs text-gray-600">Total Jobs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.activeJobs}</p>
              <p className="text-xs text-gray-600">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{stats.pendingJobs}</p>
              <p className="text-xs text-gray-600">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{stats.overdueJobs}</p>
              <p className="text-xs text-gray-600">Overdue</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.dueSoonJobs}</p>
              <p className="text-xs text-gray-600">Due Soon</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Multi-Stage Kanban Columns */}
      {visibleStages.length > 0 ? (
        <div className={`grid gap-4 ${getLayoutColumns()}`}>
          {visibleStages.map(stage => (
            <StageKanbanColumn
              key={stage.stage_id}
              stage={stage}
              jobs={jobsByStage[stage.stage_id] || []}
              onStart={startJob}
              onComplete={completeJob}
              viewMode={viewMode}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8">
            <h3 className="text-lg font-semibold mb-2">No Stages Selected</h3>
            <p className="text-gray-600 text-center mb-4">
              Select which stages to display using the column visibility controls above.
            </p>
            <ColumnVisibilityControls
              stages={consolidatedStages.filter(s => s.can_work)}
              visibleStageIds={visibleStageIds}
              onToggleStage={handleStageVisibilityToggle}
              layout={layout}
              onLayoutChange={setLayout}
            />
          </CardContent>
        </Card>
      )}

      {jobs.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-8">
            <h3 className="text-lg font-semibold mb-2">No Jobs Available</h3>
            <p className="text-gray-600 text-center">
              There are no jobs available for your accessible stages right now.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
