/**
 * Schedule Board - Production workflow-style layout with sidebar and day columns
 * NOW WITH WEEK NAVIGATION FOR VIEWING ONE WEEK AT A TIME
 */

import React, { useState } from "react";
import { ScheduleProductionSidebar } from "./sidebar/ScheduleProductionSidebar";
import { ScheduleWorkflowHeader } from "./header/ScheduleWorkflowHeader";
import { ScheduleDayColumn } from "./day-columns/ScheduleDayColumn";
import { WeekNavigation } from "./navigation/WeekNavigation";
import { JobDiagnosticsModal } from "./JobDiagnosticsModal";
import type { ScheduleDayData, ScheduledStageData } from "@/hooks/useScheduleReader";
import { useJobDiagnostics } from "@/hooks/useJobDiagnostics";
import { startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface ScheduleBoardProps {
  scheduleDays: ScheduleDayData[];
  isLoading: boolean;
  onRefresh: () => void;
  onReschedule: () => void;
  isAdminUser?: boolean;
}

export function ScheduleBoard({ 
  scheduleDays, 
  isLoading, 
  onRefresh, 
  onReschedule,
  isAdminUser = false
}: ScheduleBoardProps) {
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedStageName, setSelectedStageName] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const { isLoading: diagnosticsLoading, diagnostics, getDiagnostics } = useJobDiagnostics();

  // Filter schedule days to only show the current week (Monday to Friday)
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 }); // Sunday
  
  const weekScheduleDays = scheduleDays.filter(day => {
    const dayDate = new Date(day.date);
    return isWithinInterval(dayDate, { start: weekStart, end: weekEnd }) && 
           dayDate.getDay() >= 1 && dayDate.getDay() <= 5; // Monday to Friday only
  });

  const handleStageSelect = (stageId: string | null, stageName: string | null) => {
    setSelectedStageId(stageId);
    setSelectedStageName(stageName);
  };

  const handleJobClick = async (job: ScheduledStageData) => {
    console.log('Job clicked - opening diagnostics:', job);
    setDiagnosticsOpen(true);
    await getDiagnostics(job.id);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
            SQL Scheduler v1.0 (Protected)
          </div>
          <div className="text-xs text-muted-foreground">
            Sequential dependency-aware scheduling with FIFO ordering
          </div>
        </div>
        <ScheduleWorkflowHeader
          scheduleDays={weekScheduleDays}
          selectedStageName={selectedStageName}
          isLoading={isLoading}
          onRefresh={onRefresh}
          onReschedule={onReschedule}
        />
        
        {/* Week Navigation */}
        <div className="mt-4 flex justify-center">
          <WeekNavigation
            currentWeek={currentWeek}
            onWeekChange={setCurrentWeek}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r bg-background overflow-y-auto">
          <ScheduleProductionSidebar
            scheduleDays={weekScheduleDays}
            selectedStageId={selectedStageId}
            selectedStageName={selectedStageName}
            onStageSelect={handleStageSelect}
          />
        </div>
        
        {/* Day Columns */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-x-auto overflow-y-auto">
            <div className="flex gap-4 p-4 min-w-max">
              {weekScheduleDays.map((day) => (
            <ScheduleDayColumn 
              key={day.date}
              day={day}
              selectedStageId={selectedStageId}
              selectedStageName={selectedStageName}
              onJobClick={handleJobClick}
              isAdminUser={isAdminUser}
              onScheduleUpdate={onRefresh}
            />
              ))}
              
              {weekScheduleDays.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <p className="text-lg font-medium mb-2">No scheduled days for this week</p>
                    <p className="text-sm">Use the week navigation to view other weeks or reschedule jobs</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Job Diagnostics Modal */}
      <JobDiagnosticsModal
        open={diagnosticsOpen}
        onOpenChange={setDiagnosticsOpen}
        diagnostics={diagnostics}
        isLoading={diagnosticsLoading}
      />
    </div>
  );
}