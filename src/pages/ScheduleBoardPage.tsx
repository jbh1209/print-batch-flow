/**
 * Schedule Board Page - Read-only view of scheduled job stages
 */

import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Calendar, Zap } from "lucide-react";
import { ReadOnlyScheduleBoard } from "@/components/schedule/ReadOnlyScheduleBoard";
import { useScheduleReader } from "@/hooks/useScheduleReader";

export default function ScheduleBoardPage() {
  const { scheduleDays, isLoading, fetchSchedule, triggerReschedule } = useScheduleReader();

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const totalStages = scheduleDays.reduce((total, day) => total + day.total_stages, 0);
  const totalMinutes = scheduleDays.reduce((total, day) => total + day.total_minutes, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Schedule Board</h1>
            <p className="text-sm text-muted-foreground">
              Read-only view of server-scheduled job stages
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {scheduleDays.length} working days
              </div>
              <div className="flex items-center gap-1">
                <span>•</span>
                {totalStages} total stages
              </div>
              <div className="flex items-center gap-1">
                <span>•</span>
                {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m scheduled
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={fetchSchedule}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={triggerReschedule}
              disabled={isLoading}
              size="sm"
              className="flex items-center gap-2"
            >
              <Zap className="h-4 w-4" />
              Reschedule All
            </Button>
          </div>
        </div>
      </div>

      {/* Schedule Board */}
      <div className="flex-1 overflow-hidden">
        <ReadOnlyScheduleBoard scheduleDays={scheduleDays} />
      </div>
    </div>
  );
}