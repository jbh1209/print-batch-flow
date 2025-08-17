/**
 * Schedule Columns View - Day-based column layout for scheduled stages
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar } from "lucide-react";
import { type WorkingDayContainer } from "@/utils/scheduler/sequentialScheduler";

interface ScheduleColumnsViewProps {
  workingDays: WorkingDayContainer[];
  selectedStageId?: string | null;
  selectedDay?: string | null;
}

export function ScheduleColumnsView({ 
  workingDays, 
  selectedStageId, 
  selectedDay 
}: ScheduleColumnsViewProps) {
  
  // Filter working days based on selected day
  const filteredDays = React.useMemo(() => {
    if (!selectedDay) return workingDays;
    return workingDays.filter(day => day.date === selectedDay);
  }, [workingDays, selectedDay]);

  // Filter stages within each day based on selected stage
  const getDayStages = (day: WorkingDayContainer) => {
    if (!selectedStageId) return day.scheduled_stages;
    return day.scheduled_stages.filter(stage => stage.stage_name === selectedStageId);
  };

  if (filteredDays.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No schedule data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-x-auto">
      <div className="flex gap-4 p-4 min-w-max">
        {filteredDays.map((day) => {
          const dayStages = getDayStages(day);
          const dayName = new Date(day.date).toLocaleDateString('en-US', { 
            weekday: 'long' 
          });
          const dayDate = new Date(day.date).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
          });

          return (
            <div key={day.date} className="w-80 flex-shrink-0">
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-semibold">{dayName}</CardTitle>
                      <p className="text-sm text-muted-foreground">{dayDate}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{Math.floor(day.used_minutes / 60)}h {day.used_minutes % 60}m</span>
                      </div>
                      <Badge variant={day.remaining_minutes < 60 ? "destructive" : "secondary"} className="text-xs">
                        {Math.floor(day.remaining_minutes / 60)}h {day.remaining_minutes % 60}m left
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                  {dayStages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      {selectedStageId ? 'No stages of this type' : 'No stages scheduled'}
                    </div>
                  ) : (
                    dayStages.map((stage, index) => (
                      <div
                        key={stage.id}
                        className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              {stage.job_wo_no}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Stage {stage.stage_order}
                            </span>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {Math.floor(stage.estimated_duration_minutes / 60)}h {stage.estimated_duration_minutes % 60}m
                          </Badge>
                        </div>
                        
                        <div className="mb-2">
                          <h4 className="font-medium text-sm">{stage.stage_name}</h4>
                        </div>
                        
                        <div className="text-xs text-muted-foreground">
                          {stage.scheduled_start_at.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })} - {stage.scheduled_end_at.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}