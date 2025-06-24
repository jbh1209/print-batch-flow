
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

interface ProductionSidebarProps {
  selectedStageId?: string | null;
  onStageSelect: (stageId: string | null) => void;
  onFilterChange?: (filters: any) => void;
  consolidatedStages: any[];
  getJobCountForStage: (stageName: string) => number;
  getJobCountByStatus: (status: string) => number;
  totalActiveJobs: number;
}

export const ProductionSidebar: React.FC<ProductionSidebarProps> = ({ 
  selectedStageId,
  onStageSelect,
  onFilterChange,
  consolidatedStages,
  getJobCountForStage,
  getJobCountByStatus,
  totalActiveJobs
}) => {

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
    onFilterChange?.({ stage: null });
  };

  const handleStatusFilter = (status: string) => {
    onStageSelect(null);
    onFilterChange?.({ status: status });
  };

  return (
    <div className="w-full" style={{ overflowY: "auto", overflowX: "hidden", maxWidth: "100%" }}>
      {/* Production Stages */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Production Queues
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
              {totalActiveJobs}
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
