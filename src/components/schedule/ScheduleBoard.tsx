/**
 * Schedule Board - Production workflow-style layout with sidebar and day columns
 */

import React, { useState } from "react";
import { ScheduleProductionSidebar } from "./sidebar/ScheduleProductionSidebar";
import { ScheduleWorkflowHeader } from "./header/ScheduleWorkflowHeader";
import { ScheduleDayColumn } from "./day-columns/ScheduleDayColumn";
import type { ScheduleDayData, ScheduledStageData } from "@/hooks/useScheduleReader";

interface ScheduleBoardProps {
  scheduleDays: ScheduleDayData[];
  isLoading: boolean;
  onRefresh: () => void;
  onReschedule: () => void;
}

export function ScheduleBoard({ 
  scheduleDays, 
  isLoading, 
  onRefresh, 
  onReschedule 
}: ScheduleBoardProps) {
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedStageName, setSelectedStageName] = useState<string | null>(null);

  const handleStageSelect = (stageId: string | null, stageName: string | null) => {
    setSelectedStageId(stageId);
    setSelectedStageName(stageName);
  };

  const handleJobClick = (job: ScheduledStageData) => {
    // TODO: Open job details modal or navigate to job
    console.log('Job clicked:', job);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background p-4">
        <ScheduleWorkflowHeader
          scheduleDays={scheduleDays}
          selectedStageName={selectedStageName}
          isLoading={isLoading}
          onRefresh={onRefresh}
          onReschedule={onReschedule}
        />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r bg-background overflow-y-auto">
          <ScheduleProductionSidebar
            scheduleDays={scheduleDays}
            selectedStageId={selectedStageId}
            selectedStageName={selectedStageName}
            onStageSelect={handleStageSelect}
          />
        </div>
        
        {/* Day Columns */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-x-auto overflow-y-auto">
            <div className="flex gap-4 p-4 min-w-max">
              {scheduleDays.map((day) => (
            <ScheduleDayColumn 
              key={day.date}
              day={day}
              selectedStageId={selectedStageId}
              selectedStageName={selectedStageName}
              onJobClick={handleJobClick}
            />
              ))}
              
              {scheduleDays.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <p className="text-lg font-medium mb-2">No scheduled days found</p>
                    <p className="text-sm">Schedule data will appear here once jobs are scheduled</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}