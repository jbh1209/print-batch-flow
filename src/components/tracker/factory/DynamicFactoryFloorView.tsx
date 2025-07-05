import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  RefreshCw, 
  Users, 
  Settings,
  Clock,
  Sliders,
  Eye,
  EyeOff
} from "lucide-react";
import { useAccessibleJobs } from "@/hooks/tracker/useAccessibleJobs";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useUserStagePermissions } from "@/hooks/tracker/useUserStagePermissions";
import { consolidateStagesByMasterQueue } from "@/utils/tracker/stageConsolidation";
import { TrackerErrorBoundary } from "../error-boundaries/TrackerErrorBoundary";
import { FactoryFloorStageSection } from "./FactoryFloorStageSection";
import { FactoryFloorSettings } from "./FactoryFloorSettings";
import { useFactoryFloorPreferences } from "./useFactoryFloorPreferences";
import type { ConsolidatedStage } from "@/utils/tracker/stageConsolidation";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs/types";

export const DynamicFactoryFloorView = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);
  
  const { 
    jobs, 
    isLoading, 
    error, 
    refreshJobs 
  } = useAccessibleJobs({
    permissionType: 'work'
  });

  const {
    consolidatedStages,
    isLoading: stagesLoading,
    error: stagesError
  } = useUserStagePermissions(user?.id);

  const {
    preferences,
    toggleStageVisibility,
    resetPreferences
  } = useFactoryFloorPreferences();

  // Group jobs by their current stage
  const jobsByStage = useMemo(() => {
    const stageJobMap = new Map<string, AccessibleJob[]>();
    
    jobs.forEach(job => {
      const stageId = job.current_stage_id;
      if (stageId) {
        if (!stageJobMap.has(stageId)) {
          stageJobMap.set(stageId, []);
        }
        stageJobMap.get(stageId)!.push(job);
      }
    });
    
    return stageJobMap;
  }, [jobs]);

  // Get visible stages based on user preferences
  const visibleStages = useMemo(() => {
    return consolidatedStages.filter(stage => {
      // Show stages that have work permission and are not hidden by user
      return stage.can_work && !preferences.hiddenStages.includes(stage.stage_id);
    });
  }, [consolidatedStages, preferences.hiddenStages]);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('❌ Logout failed:', error);
    }
  };

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  if (isLoading || stagesLoading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex-shrink-0 p-4 bg-card border-b">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin mr-2" />
            <span>Loading factory floor...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || stagesError) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex-shrink-0 p-4 bg-card border-b">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-destructive font-medium mb-2">Error loading factory floor</p>
              <p className="text-muted-foreground text-sm mb-4">{error || stagesError}</p>
              <Button onClick={refreshJobs} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate total stats for all visible stages
  const totalStats = visibleStages.reduce((acc, stage) => {
    const stageJobs = jobsByStage.get(stage.stage_id) || [];
    const masterQueueJobs = stage.is_master_queue 
      ? stage.subsidiary_stages.flatMap(sub => jobsByStage.get(sub.stage_id) || [])
      : [];
    const allStageJobs = [...stageJobs, ...masterQueueJobs];
    
    acc.totalJobs += allStageJobs.length;
    acc.activeJobs += allStageJobs.filter(job => job.current_stage_status === 'active').length;
    acc.pendingJobs += allStageJobs.filter(job => job.current_stage_status === 'pending').length;
    
    return acc;
  }, { totalJobs: 0, activeJobs: 0, pendingJobs: 0 });

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex-shrink-0 p-4 bg-card border-b">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Factory Floor Dashboard</h1>
            <p className="text-muted-foreground">Production overview and job management</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2"
            >
              <Sliders className="h-4 w-4" />
              Customize View
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshJobs}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNavigation('/tracker/admin')}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStats.totalJobs}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{totalStats.activeJobs}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ready to Start</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{totalStats.pendingJobs}</div>
            </CardContent>
          </Card>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <TrackerErrorBoundary componentName="Factory Floor Settings">
            <FactoryFloorSettings
              stages={consolidatedStages.filter(stage => stage.can_work)}
              preferences={preferences}
              onToggleStage={toggleStageVisibility}
              onReset={resetPreferences}
            />
          </TrackerErrorBoundary>
        )}
      </div>

      {/* Stage Sections */}
      <div className="flex-1 p-4 overflow-auto">
        {visibleStages.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Workable Stages</h3>
              <p className="text-muted-foreground text-center max-w-md">
                You don't have permission to work on any production stages, or all stages are hidden.
                Check your permissions or adjust your view settings.
              </p>
              <Button
                onClick={() => setShowSettings(true)}
                variant="outline"
                className="mt-4"
              >
                <Eye className="h-4 w-4 mr-2" />
                Show Settings
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {visibleStages.map((stage) => (
              <TrackerErrorBoundary key={stage.stage_id} componentName={`Stage ${stage.stage_name}`}>
                <FactoryFloorStageSection
                  stage={stage}
                  jobs={jobsByStage.get(stage.stage_id) || []}
                  masterQueueJobs={stage.is_master_queue 
                    ? stage.subsidiary_stages.flatMap(sub => jobsByStage.get(sub.stage_id) || [])
                    : []
                  }
                  onNavigate={handleNavigation}
                />
              </TrackerErrorBoundary>
            ))}
          </div>
        )}

        {/* Recent Activity */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>Recent job activity will appear here</p>
              <p className="text-sm mt-1">Start working on jobs to see real-time updates</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};