
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

interface ProductionSidebarProps {
  jobs: AccessibleJob[];
  consolidatedStages: any[];
  selectedStageId?: string | null;
  selectedStageName?: string | null;
  onStageSelect: (stageId: string | null, stageName: string | null) => void;
}

export const ProductionSidebar: React.FC<ProductionSidebarProps> = ({ 
  jobs,
  consolidatedStages,
  selectedStageId,
  selectedStageName,
  onStageSelect
}) => {

  const getJobCountForStage = (stageName: string) => {
    return jobs.filter(job => {
      const currentStage = job.current_stage_name || job.display_stage_name;
      
      // Check if job's current stage matches
      if (currentStage === stageName) {
        return true;
      }
      
      // Check if job has current parallel stages that match
      if (job.parallel_stages && job.parallel_stages.length > 0) {
        // Calculate current stage order from parallel stages (same logic as getJobParallelStages)
        const activeStages = job.parallel_stages.filter(stage => 
          stage.stage_status === 'active' || stage.stage_status === 'pending'
        );
        
        if (activeStages.length > 0) {
          const currentOrder = Math.min(...activeStages.map(s => s.stage_order));
          const currentParallelStages = activeStages.filter(stage => 
            stage.stage_order === currentOrder
          );
          return currentParallelStages.some(stage => stage.stage_name === stageName);
        }
      }
      
      return false;
    }).length;
  };

  const getJobCountByStatus = (status: string) => {
    return jobs.filter(job => {
      const hasActiveStage = job.current_stage_status === 'active';
      const hasPendingStages = job.current_stage_status === 'pending';
      const allCompleted = job.workflow_progress === 100;
      
      switch (status) {
        case 'completed': return allCompleted;
        case 'in-progress': return hasActiveStage;
        case 'pending': return hasPendingStages;
        case 'overdue':
          if (!job.due_date) return false;
          const dueDate = new Date(job.due_date);
          const today = new Date();
          return dueDate < today && !allCompleted;
        default: return false;
      }
    }).length;
  };

  const handleStageClick = (stageId: string, stageName: string) => {
    console.log('Sidebar stage clicked:', { stageId, stageName, selectedStageId, selectedStageName });
    
    if (selectedStageId === stageId) {
      // Clicking the same stage - deselect it
      onStageSelect(null, null);
    } else {
      // Select the new stage
      onStageSelect(stageId, stageName);
    }
  };

  const handleAllJobsClick = () => {
    console.log('All jobs clicked');
    onStageSelect(null, null);
  };

  const handleStatusFilter = (status: string) => {
    console.log('Status filter clicked:', status);
    // For now, just show all jobs - could extend this later
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
                </span>
                <Badge variant="secondary" className="ml-auto text-xs font-bold">
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
