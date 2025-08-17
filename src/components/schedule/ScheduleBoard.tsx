/**
 * Schedule Board - Simple sequential view of scheduled job stages
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar } from "lucide-react";
import { type WorkingDayContainer } from "@/utils/scheduler/sequentialScheduler";

interface ScheduleBoardProps {
  workingDays: WorkingDayContainer[];
}

export function ScheduleBoard({ workingDays }: ScheduleBoardProps) {
  if (workingDays.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No schedule generated yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        {workingDays.map((day) => (
          <Card key={day.date} className="border-l-4 border-l-primary">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">
                  {new Date(day.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </CardTitle>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{Math.floor(day.used_minutes / 60)}h {day.used_minutes % 60}m used</span>
                  </div>
                  <Badge variant={day.remaining_minutes < 60 ? "destructive" : "secondary"}>
                    {Math.floor(day.remaining_minutes / 60)}h {day.remaining_minutes % 60}m remaining
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {day.scheduled_stages.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No stages scheduled</p>
              ) : (
                <div className="space-y-2">
                  {day.scheduled_stages.map((stage, index) => (
                    <div
                      key={stage.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono">
                          {stage.job_wo_no}
                        </Badge>
                        <span className="font-medium">{stage.stage_name}</span>
                        <span className="text-sm text-muted-foreground">
                          Stage {stage.stage_order}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-muted-foreground">
                          {stage.scheduled_start_at.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })} - {stage.scheduled_end_at.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })}
                        </span>
                        <Badge variant="secondary">
                          {Math.floor(stage.estimated_duration_minutes / 60)}h {stage.estimated_duration_minutes % 60}m
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}