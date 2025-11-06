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
import { ScheduleDiagnosticsModal } from "./ScheduleDiagnosticsModal";
import type { ScheduleDayData, ScheduledStageData } from "@/hooks/useScheduleReader";
import { useJobDiagnostics } from "@/hooks/useJobDiagnostics";
import { useScheduleDiagnostics } from "@/hooks/useScheduleDiagnostics";
import { startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { Button } from "@/components/ui/button";
import { Activity } from "lucide-react";

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
  const [scheduleDiagnosticsOpen, setScheduleDiagnosticsOpen] = useState(false);
  const { isLoading: diagnosticsLoading, diagnostics, getDiagnostics } = useJobDiagnostics();
  const { 
    isLoading: scheduleDiagnosticsLoading, 
    diagnostics: scheduleDiagnostics, 
    fetchDiagnostics 
  } = useScheduleDiagnostics();

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

  const handleScheduleDiagnostics = async () => {
    setScheduleDiagnosticsOpen(true);
    await fetchDiagnostics();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background p-4">
        <div className="flex items-center justify-between mb-4">
          <ScheduleWorkflowHeader
            scheduleDays={weekScheduleDays}
            selectedStageName={selectedStageName}
            isLoading={isLoading}
            onRefresh={onRefresh}
            onReschedule={onReschedule}
          />
          
          {/* Admin Diagnostics Button */}
          {isAdminUser && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleScheduleDiagnostics}
              className="ml-4"
            >
              <Activity className="h-4 w-4 mr-2" />
              Diagnostics
            </Button>
          )}
        </div>
        
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

      {/* Schedule Diagnostics Modal */}
      <ScheduleDiagnosticsModal
        open={scheduleDiagnosticsOpen}
        onOpenChange={setScheduleDiagnosticsOpen}
        diagnostics={scheduleDiagnostics}
        isLoading={scheduleDiagnosticsLoading}
      />
    </div>
  );
}