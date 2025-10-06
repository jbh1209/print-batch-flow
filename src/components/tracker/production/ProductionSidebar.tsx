
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Settings,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  Play
} from "lucide-react";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import type { JobStageWithDetails } from "@/hooks/tracker/useRealTimeJobStages/types";

interface ProductionSidebarProps {
  jobs: AccessibleJob[];
  jobStages: JobStageWithDetails[];
  consolidatedStages: any[];
  selectedStageId?: string | null;
  selectedStageName?: string | null;
  stageStatusFilter: 'active' | 'pending' | 'on_hold';
  onStageSelect: (stageId: string | null, stageName: string | null) => void;
  onStatusFilterChange: (status: 'active' | 'pending' | 'on_hold') => void;
}

export const ProductionSidebar: React.FC<ProductionSidebarProps> = ({ 
  jobs,
  jobStages,
  consolidatedStages,
  selectedStageId,
  selectedStageName,
  stageStatusFilter,
  onStageSelect,
  onStatusFilterChange
}) => {

  const getJobCountForStage = (stageId: string) => {
    // Count unique job IDs with this stage at the selected status
    const uniqueJobs = new Set(
      jobStages
        .filter(stage => 
          stage.production_stage_id === stageId && 
          stage.status === stageStatusFilter
        )
        .map(stage => stage.job_id)
    );
    return uniqueJobs.size;
  };

  const handleStageClick = (stageId: string, stageName: string) => {
    if (selectedStageId === stageId) {
      onStageSelect(null, null);
    } else {
      onStageSelect(stageId, stageName);
    }
  };

  const handleAllJobsClick = () => {
    onStageSelect(null, null);
  };

  return (
    <div className="w-full overflow-y-auto p-4">
      {/* Production Stages */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Production Stages
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <Button 
            variant={!selectedStageId ? "default" : "ghost"} 
            size="sm" 
            className="w-full justify-start text-xs h-8"
            onClick={handleAllJobsClick}
          >
            All Jobs
            <Badge variant="secondary" className="ml-auto text-xs">
              {jobs.length}
            </Badge>
          </Button>
          {consolidatedStages.map(stage => {
            const jobCount = getJobCountForStage(stage.stage_id);
            const isSelected = selectedStageId === stage.stage_id;
            return (
              <Button 
                key={stage.stage_id}
                variant={isSelected ? "default" : "ghost"}
                size="sm"
                className="w-full justify-start text-xs h-8"
                onClick={() => handleStageClick(stage.stage_id, stage.stage_name)}
              >
                <div 
                  className="w-2 h-2 rounded-full mr-2 flex-shrink-0"
                  style={{ backgroundColor: stage.stage_color }}
                />
                <span className="truncate flex-1 text-left">
                  {stage.stage_name}
                </span>
                <Badge variant="secondary" className="ml-auto text-xs font-bold">
                  {jobCount}
                </Badge>
              </Button>
            );
          })}
        </CardContent>
      </Card>

      {/* Stage Status Filter */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            Stage Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {[
            { id: 'active' as const, label: 'Active', icon: Play, color: 'text-blue-500' },
            { id: 'pending' as const, label: 'Pending', icon: Clock, color: 'text-yellow-500' },
            { id: 'on_hold' as const, label: 'On Hold', icon: AlertCircle, color: 'text-orange-500' }
          ].map(status => (
            <Button 
              key={status.id}
              variant={stageStatusFilter === status.id ? "default" : "ghost"} 
              size="sm" 
              className="w-full justify-start text-xs h-8"
              onClick={() => onStatusFilterChange(status.id)}
            >
              <status.icon className={`h-3 w-3 mr-2 ${stageStatusFilter === status.id ? '' : status.color}`} />
              <span className="flex-1 text-left">{status.label}</span>
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Stage Management */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Stage Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start text-xs">
            <Plus className="h-3 w-3 mr-2" />
            Add Stage
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start text-xs">
            <Settings className="h-3 w-3 mr-2" />
            Configure Workflow
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
