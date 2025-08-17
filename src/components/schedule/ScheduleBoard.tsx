/**
 * Schedule Board - Production workflow-style layout with sidebar and day columns
 */

import React, { useState } from "react";
import { ScheduleSidebar } from "./ScheduleSidebar";
import { ScheduleColumnsView } from "./ScheduleColumnsView";
import { type WorkingDayContainer } from "@/utils/scheduler/sequentialScheduler";

interface ScheduleBoardProps {
  workingDays: WorkingDayContainer[];
}

export function ScheduleBoard({ workingDays }: ScheduleBoardProps) {
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const handleStageSelect = (stageId: string | null) => {
    setSelectedStageId(stageId);
  };

  const handleDaySelect = (day: string | null) => {
    setSelectedDay(day);
  };

  return (
    <div className="flex h-full">
      <div className="w-64 border-r bg-white overflow-y-auto">
        <ScheduleSidebar
          workingDays={workingDays}
          selectedStageId={selectedStageId}
          selectedDay={selectedDay}
          onStageSelect={handleStageSelect}
          onDaySelect={handleDaySelect}
        />
      </div>
      
      <div className="flex-1 overflow-hidden">
        <ScheduleColumnsView
          workingDays={workingDays}
          selectedStageId={selectedStageId}
          selectedDay={selectedDay}
        />
      </div>
    </div>
  );
}