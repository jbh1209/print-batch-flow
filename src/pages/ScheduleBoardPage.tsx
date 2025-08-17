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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Schedule Board</h1>
            <p className="text-sm text-muted-foreground">
              Sequential scheduling of job stages into working days
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={generateSchedule}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Generate Schedule
            </Button>
            <Button
              onClick={saveSchedule}
              disabled={isUpdating || workingDays.length === 0}
              size="sm"
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Schedule
            </Button>
          </div>
        </div>
      </div>

      {/* Schedule Board with Sidebar Layout */}
      <div className="flex-1 overflow-hidden">
        <ScheduleBoard workingDays={workingDays} />
      </div>
    </div>
  );
}