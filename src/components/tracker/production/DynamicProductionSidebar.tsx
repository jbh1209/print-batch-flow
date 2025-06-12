
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Settings,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  Play
} from "lucide-react";
import { useProductionData } from "@/hooks/tracker/useProductionData";
import { useUserStagePermissions } from "@/hooks/tracker/useUserStagePermissions";

interface DynamicProductionSidebarProps {
  selectedStageId?: string;
  onStageSelect: (stageId: string | null) => void;
  onFilterChange?: (filters: any) => void;
}

export const DynamicProductionSidebar: React.FC<DynamicProductionSidebarProps> = ({ 
  selectedStageId,
  onStageSelect,
  onFilterChange 
}) => {
  const { activeJobs, isLoading: jobsLoading } = useProductionData();
  const { consolidatedStages, isLoading: stagesLoading } = useUserStagePermissions();

  // Count jobs by stage using display names (master queue aware)
  const getJobCountForStage = (stageName: string) => {
    return activeJobs.filter(job => {
      const effectiveStageDisplay = job.display_stage_name || job.current_stage_name;
      return effectiveStageDisplay?.toLowerCase() === stageName.toLowerCase();
    }).length;
  };

  // Count jobs by status
  const getJobCountByStatus = (status: string) => {
    return activeJobs.filter(job => {
      switch (status) {
        case 'completed':
          return job.is_completed;
        case 'in-progress':
          return job.is_active;
        case 'pending':
          return job.is_pending;
        case 'overdue':
          if (!job.due_date) return false;
          const dueDate = new Date(job.due_date);
          const today = new Date();
          return dueDate < today && !job.is_completed;
        default:
          return false;
      }
    }).length;
  };

  const handleStageClick = (stageId: string, stageName: string) => {
    if (selectedStageId === stageId) {
      onStageSelect(null);
      onFilterChange?.({ stage: null });
    } else {
      onStageSelect(stageId);
      onFilterChange?.({ stage: stageName });
    }
  };

  const handleAllJobsClick = () => {
    onStageSelect(null);
    onFilterChange?.({ stage: null }); // Clear all filters to show all jobs
  };

  const handleStatusFilter = (status: string) => {
    onStageSelect(null);
    onFilterChange?.({ status: status });
  };

  if (stagesLoading || jobsLoading) {
    return (
      <div className="w-64 bg-gray-50 border-r border-gray-200 p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 overflow-y-auto">
      {/* Production Stages */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Production Queues
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {/* All Jobs Button */}
          <Button 
            variant={!selectedStageId ? "default" : "ghost"} 
            size="sm" 
            className="w-full justify-start text-xs h-8"
            onClick={handleAllJobsClick}
          >
            All Jobs
            <Badge variant="secondary" className="ml-auto text-xs">
              {activeJobs.length}
            </Badge>
          </Button>
          
          {/* Show consolidated stages (master queues + standalone stages) */}
          {consolidatedStages
            .sort((a, b) => a.stage_name.localeCompare(b.stage_name))
            .map(stage => {
              const jobCount = getJobCountForStage(stage.stage_name);
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
                    {stage.is_master_queue && stage.subsidiary_stages.length > 0 && (
                      <span className="text-xs text-gray-500 ml-1">
                        ({stage.subsidiary_stages.length})
                      </span>
                    )}
                  </span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {jobCount}
                  </Badge>
                </Button>
              );
            })}
        </CardContent>
      </Card>

      {/* Quick Status Filters */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            Status Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {[
            { id: 'completed', label: 'Completed', icon: CheckCircle, color: 'text-green-500' },
            { id: 'in-progress', label: 'In Progress', icon: Play, color: 'text-blue-500' },
            { id: 'pending', label: 'Pending', icon: Clock, color: 'text-yellow-500' },
            { id: 'overdue', label: 'Overdue', icon: AlertCircle, color: 'text-red-500' }
          ].map(status => (
            <Button 
              key={status.id}
              variant="ghost" 
              size="sm" 
              className="w-full justify-start text-xs h-8"
              onClick={() => handleStatusFilter(status.id)}
            >
              <status.icon className={`h-3 w-3 mr-2 ${status.color}`} />
              <span className="flex-1 text-left">{status.label}</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                {getJobCountByStatus(status.id)}
              </Badge>
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
