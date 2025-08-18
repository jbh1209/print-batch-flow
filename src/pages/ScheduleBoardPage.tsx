/**
 * Schedule Board Page - Read-only view of scheduled job stages
 */

import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Calendar, Zap } from "lucide-react";
import { ScheduleBoard } from "@/components/schedule/ScheduleBoard";
import { useScheduleReader } from "@/hooks/useScheduleReader";

export default function ScheduleBoardPage() {
  const { scheduleDays, isLoading, fetchSchedule, triggerReschedule } = useScheduleReader();

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  return (
    <div className="h-full">
      <ScheduleBoard 
        scheduleDays={scheduleDays}
        isLoading={isLoading}
        onRefresh={fetchSchedule}
        onReschedule={triggerReschedule}
      />
    </div>
  );
}