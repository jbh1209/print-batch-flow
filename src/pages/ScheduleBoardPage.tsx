/**
 * Schedule Board Page - Sequential job stage scheduling
 */

import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, Save, Calendar } from "lucide-react";
import { ScheduleBoard } from "@/components/schedule/ScheduleBoard";
import { useSequentialScheduler } from "@/hooks/useSequentialScheduler";

export default function ScheduleBoardPage() {
  const { workingDays, isLoading, isUpdating, generateSchedule, saveSchedule } = useSequentialScheduler();

  useEffect(() => {
    generateSchedule();
  }, [generateSchedule]);

  const totalStages = workingDays.reduce((total, day) => total + day.scheduled_stages.length, 0);
  const totalUsedMinutes = workingDays.reduce((total, day) => total + day.used_minutes, 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schedule Board</h1>
          <p className="text-muted-foreground">
            Sequential scheduling of job stages into working days
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={generateSchedule}
            disabled={isLoading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Generate Schedule
          </Button>
          <Button
            onClick={saveSchedule}
            disabled={isUpdating || workingDays.length === 0}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            Save Schedule
          </Button>
        </div>
      </div>

      {/* Schedule Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Working Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workingDays.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Stages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStages}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.floor(totalUsedMinutes / 60)}h {totalUsedMinutes % 60}m
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {workingDays.length > 0 
                ? Math.round((totalUsedMinutes / (workingDays.length * 480)) * 100)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schedule Board */}
      <ScheduleBoard workingDays={workingDays} />
    </div>
  );
}