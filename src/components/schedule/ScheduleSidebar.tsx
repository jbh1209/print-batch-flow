/**
 * Schedule Sidebar - Stage and day filtering for the schedule board
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Settings } from "lucide-react";
import { type WorkingDayContainer } from "@/utils/scheduler/sequentialScheduler";

interface ScheduleSidebarProps {
  workingDays: WorkingDayContainer[];
  selectedStageId?: string | null;
  selectedDay?: string | null;
  onStageSelect: (stageId: string | null) => void;
  onDaySelect: (day: string | null) => void;
}

export function ScheduleSidebar({ 
  workingDays, 
  selectedStageId, 
  selectedDay,
  onStageSelect, 
  onDaySelect 
}: ScheduleSidebarProps) {
  
  // Get all unique stages from scheduled jobs
  const consolidatedStages = React.useMemo(() => {
    const stageMap = new Map();
    
    workingDays.forEach(day => {
      day.scheduled_stages.forEach(stage => {
        if (!stageMap.has(stage.stage_name)) {
          stageMap.set(stage.stage_name, {
            stage_name: stage.stage_name,
            count: 0
          });
        }
        stageMap.get(stage.stage_name).count++;
      });
    });
    
    return Array.from(stageMap.values());
  }, [workingDays]);

  const getStageCount = (stageName: string) => {
    return workingDays.reduce((total, day) => {
      return total + day.scheduled_stages.filter(stage => stage.stage_name === stageName).length;
    }, 0);
  };

  const getDayCount = (targetDate: string) => {
    const day = workingDays.find(day => day.date === targetDate);
    return day ? day.scheduled_stages.length : 0;
  };

  const handleStageClick = (stageName: string) => {
    if (selectedStageId === stageName) {
      onStageSelect(null);
    } else {
      onStageSelect(stageName);
    }
  };

  const handleDayClick = (dayDate: string) => {
    if (selectedDay === dayDate) {
      onDaySelect(null);
    } else {
      onDaySelect(dayDate);
    }
  };

  const handleAllStagesClick = () => {
    onStageSelect(null);
  };

  const handleAllDaysClick = () => {
    onDaySelect(null);
  };

  const totalStages = workingDays.reduce((total, day) => total + day.scheduled_stages.length, 0);
  const totalUsedMinutes = workingDays.reduce((total, day) => total + day.used_minutes, 0);
  const avgUtilization = workingDays.length > 0 
    ? Math.round((totalUsedMinutes / (workingDays.length * 480)) * 100)
    : 0;

  return (
    <div className="w-full overflow-y-auto p-4 space-y-4">
      {/* Schedule Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Schedule Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-xs">
            <span>Working Days:</span>
            <Badge variant="secondary">{workingDays.length}</Badge>
          </div>
          <div className="flex justify-between text-xs">
            <span>Total Stages:</span>
            <Badge variant="secondary">{totalStages}</Badge>
          </div>
          <div className="flex justify-between text-xs">
            <span>Total Hours:</span>
            <Badge variant="secondary">
              {Math.floor(totalUsedMinutes / 60)}h {totalUsedMinutes % 60}m
            </Badge>
          </div>
          <div className="flex justify-between text-xs">
            <span>Avg Utilization:</span>
            <Badge variant={avgUtilization > 80 ? "default" : "secondary"}>
              {avgUtilization}%
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stage Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Filter by Stage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <Button 
            variant={!selectedStageId ? "default" : "ghost"} 
            size="sm" 
            className="w-full justify-start text-xs h-8"
            onClick={handleAllStagesClick}
          >
            All Stages
            <Badge variant="secondary" className="ml-auto text-xs">
              {totalStages}
            </Badge>
          </Button>
          {consolidatedStages.map(stage => {
            const isSelected = selectedStageId === stage.stage_name;
            const stageCount = getStageCount(stage.stage_name);
            return (
              <Button 
                key={stage.stage_name}
                variant={isSelected ? "default" : "ghost"}
                size="sm"
                className="w-full justify-start text-xs h-8"
                onClick={() => handleStageClick(stage.stage_name)}
              >
                <span className="truncate flex-1 text-left">
                  {stage.stage_name}
                </span>
                <Badge variant="secondary" className="ml-auto text-xs font-bold">
                  {stageCount}
                </Badge>
              </Button>
            );
          })}
        </CardContent>
      </Card>

      {/* Day Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Filter by Day
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <Button 
            variant={!selectedDay ? "default" : "ghost"} 
            size="sm" 
            className="w-full justify-start text-xs h-8"
            onClick={handleAllDaysClick}
          >
            All Days
            <Badge variant="secondary" className="ml-auto text-xs">
              {workingDays.length}
            </Badge>
          </Button>
          {workingDays.map(day => {
            const isSelected = selectedDay === day.date;
            const dayCount = getDayCount(day.date);
            const dayName = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
            const dayDate = new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            return (
              <Button 
                key={day.date}
                variant={isSelected ? "default" : "ghost"}
                size="sm"
                className="w-full justify-start text-xs h-8"
                onClick={() => handleDayClick(day.date)}
              >
                <div className="flex flex-col items-start flex-1">
                  <span className="font-medium">{dayName}</span>
                  <span className="text-xs text-muted-foreground">{dayDate}</span>
                </div>
                <Badge variant="secondary" className="ml-auto text-xs font-bold">
                  {dayCount}
                </Badge>
              </Button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}