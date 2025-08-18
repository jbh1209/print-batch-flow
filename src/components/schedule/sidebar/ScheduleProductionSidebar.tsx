import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Settings,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Play
} from "lucide-react";
import type { ScheduleDayData } from "@/hooks/useScheduleReader";

interface ScheduleProductionSidebarProps {
  scheduleDays: ScheduleDayData[];
  selectedStageId?: string | null;
  selectedStageName?: string | null;
  onStageSelect: (stageId: string | null, stageName: string | null) => void;
}

export const ScheduleProductionSidebar: React.FC<ScheduleProductionSidebarProps> = ({ 
  scheduleDays,
  selectedStageId,
  selectedStageName,
  onStageSelect
}) => {

  // Extract all unique stages from scheduled data
  const consolidatedStages = React.useMemo(() => {
    const stageMap = new Map();
    
    scheduleDays.forEach(day => {
      day.time_slots?.forEach(slot => {
        slot.scheduled_stages?.forEach(stage => {
          if (!stageMap.has(stage.id)) {
            stageMap.set(stage.id, {
              stage_id: stage.id,
              stage_name: stage.stage_name,
              stage_color: stage.stage_color || '#6B7280'
            });
          }
        });
      });
    });
    
    return Array.from(stageMap.values()).sort((a, b) => a.stage_name.localeCompare(b.stage_name));
  }, [scheduleDays]);

  const getStageJobCount = (stageId: string) => {
    let count = 0;
    scheduleDays.forEach(day => {
      day.time_slots?.forEach(slot => {
        const stageJobs = slot.scheduled_stages?.filter(stage => stage.id === stageId) || [];
        count += stageJobs.length;
      });
    });
    return count;
  };

  const getTotalScheduledJobs = () => {
    let count = 0;
    scheduleDays.forEach(day => {
      day.time_slots?.forEach(slot => {
        count += slot.scheduled_stages?.length || 0;
      });
    });
    return count;
  };

  const handleStageClick = (stageId: string, stageName: string) => {
    if (selectedStageId === stageId) {
      // Clicking the same stage - deselect it
      onStageSelect(null, null);
    } else {
      // Select the new stage
      onStageSelect(stageId, stageName);
    }
  };

  const handleAllJobsClick = () => {
    onStageSelect(null, null);
  };

  return (
    <div className="w-full overflow-y-auto p-4">
      {/* Schedule Overview */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Schedule Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-xs">
            <span>Working Days:</span>
            <Badge variant="secondary">{scheduleDays.length}</Badge>
          </div>
          <div className="flex justify-between text-xs">
            <span>Total Jobs:</span>
            <Badge variant="secondary">{getTotalScheduledJobs()}</Badge>
          </div>
          <div className="flex justify-between text-xs">
            <span>Total Hours:</span>
            <Badge variant="secondary">
              {Math.floor(scheduleDays.reduce((total, day) => total + day.total_minutes, 0) / 60)}h
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Production Stages */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Scheduled Stages
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <Button 
            variant={!selectedStageId ? "default" : "ghost"} 
            size="sm" 
            className="w-full justify-start text-xs h-8"
            onClick={handleAllJobsClick}
          >
            All Scheduled Jobs
            <Badge variant="secondary" className="ml-auto text-xs">
              {getTotalScheduledJobs()}
            </Badge>
          </Button>
          {consolidatedStages.map(stage => {
            const jobCount = getStageJobCount(stage.stage_id);
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
    </div>
  );
};