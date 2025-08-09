import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, ChevronLeft, ChevronRight, List, Grid3X3 } from 'lucide-react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { DraggableJobCard } from '@/components/production/DraggableJobCard';
import { DroppableDay } from '@/components/production/DroppableDay';
import type { AccessibleJob } from '@/hooks/tracker/useAccessibleJobs';

interface WeeklyProductionScheduleProps {
  jobs: AccessibleJob[];
  selectedStage?: string | null;
  onJobClick: (job: AccessibleJob) => void;
  onStageAction: (jobId: string, stageId: string, action: 'start' | 'complete' | 'qr-scan') => void;
  onRefresh: () => void;
}

interface ScheduledJob {
  id: string;
  wo_no: string;
  customer: string;
  status: string;
  estimated_hours: number;
  estimated_minutes: number;
  scheduled_date: string;
  priority: number;
  is_expedited: boolean;
  current_stage?: string;
  accessibleJob: AccessibleJob;
}

interface ShiftSchedule {
  shiftNumber: 1 | 2 | 3;
  startTime: string;
  endTime: string;
  capacity: number; // minutes
  used: number; // minutes
  jobs: JobSegment[];
}

interface JobSegment {
  jobId: string;
  duration: number; // minutes in this shift
  isPartial: boolean;
  shiftNumber: number;
  job: ScheduledJob;
}

interface DaySchedule {
  date: string;
  jobs: ScheduledJob[];
  shifts: ShiftSchedule[];
  total_hours: number;
  total_minutes: number;
  capacity_hours: number;
  capacity_minutes: number;
  utilization: number;
  is_working_day: boolean;
}

export const WeeklyProductionSchedule: React.FC<WeeklyProductionScheduleProps> = ({
  jobs,
  selectedStage,
  onJobClick,
  onStageAction,
  onRefresh
}) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedJob, setDraggedJob] = useState<ScheduledJob | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Helper function to calculate shift schedules for a day
  const calculateDayShifts = (dayJobs: ScheduledJob[]): ShiftSchedule[] => {
    const SHIFT_CAPACITY = 480; // 8 hours in minutes
    const shifts: ShiftSchedule[] = [
      { shiftNumber: 1, startTime: '06:00', endTime: '14:00', capacity: SHIFT_CAPACITY, used: 0, jobs: [] },
      { shiftNumber: 2, startTime: '14:00', endTime: '22:00', capacity: SHIFT_CAPACITY, used: 0, jobs: [] },
      { shiftNumber: 3, startTime: '22:00', endTime: '06:00', capacity: SHIFT_CAPACITY, used: 0, jobs: [] }
    ];

    // Sort jobs by priority (expedited first, then by scheduled time)
    const sortedJobs = [...dayJobs].sort((a, b) => {
      if (a.is_expedited !== b.is_expedited) {
        return a.is_expedited ? -1 : 1;
      }
      return a.priority - b.priority;
    });

    let currentShiftIndex = 0;

    sortedJobs.forEach(job => {
      let remainingDuration = job.estimated_minutes;

      while (remainingDuration > 0 && currentShiftIndex < shifts.length) {
        const currentShift = shifts[currentShiftIndex];
        const availableCapacity = currentShift.capacity - currentShift.used;

        if (availableCapacity <= 0) {
          currentShiftIndex++;
          continue;
        }

        const durationForThisShift = Math.min(remainingDuration, availableCapacity);
        const isPartial = durationForThisShift < remainingDuration;

        currentShift.jobs.push({
          jobId: job.id,
          duration: durationForThisShift,
          isPartial,
          shiftNumber: currentShift.shiftNumber,
          job
        });

        currentShift.used += durationForThisShift;
        remainingDuration -= durationForThisShift;

        if (currentShift.used >= currentShift.capacity) {
          currentShiftIndex++;
        }
      }
    });

    return shifts;
  };

  // Smart job scheduling algorithm that fills available capacity across days
  const weekSchedule = useMemo(() => {
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
    const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
    const DAILY_CAPACITY = 480; // 8 hours in minutes
    
    // Get all jobs for scheduling (not just those due this week)
    const jobsForWeek = jobs
      .filter(job => job.due_date)
      .map(job => {
        // Get estimated minutes from job stage instances
        const estimatedMinutes = job.job_stage_instances?.reduce((total, instance) => {
          return total + (instance.estimated_duration_minutes || 0);
        }, 0) || Math.max(240, (job.qty || 100) * 2); // Fallback: 2 mins per unit, min 4 hours

        return {
          id: job.job_id,
          wo_no: job.wo_no || 'Unknown',
          customer: job.customer || 'Unknown',
          status: job.status || 'Unknown',
          estimated_hours: Math.round(estimatedMinutes / 60 * 100) / 100,
          estimated_minutes: estimatedMinutes,
          due_date: new Date(job.due_date),
          priority: (job as any).proof_approved_manually_at ? 
            new Date((job as any).proof_approved_manually_at).getTime() : 
            ((job as any).is_expedited ? 1 : Date.now()),
          is_expedited: (job as any).is_expedited || false,
          current_stage: job.display_stage_name,
          accessibleJob: job
        };
      })
      .sort((a, b) => {
        // Sort by expedited first, then by proof approval date, then by due date
        if (a.is_expedited !== b.is_expedited) {
          return a.is_expedited ? -1 : 1;
        }
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return a.due_date.getTime() - b.due_date.getTime();
      });

    // Initialize daily schedules with empty capacity
    const dailySchedules = weekDays.map(date => ({
      date: format(date, 'yyyy-MM-dd'),
      dateObj: date,
      jobs: [] as ScheduledJob[],
      availableCapacity: DAILY_CAPACITY,
      shifts: [] as ShiftSchedule[],
      total_hours: 0,
      total_minutes: 0,
      capacity_hours: 8,
      capacity_minutes: 480,
      utilization: 0,
      is_working_day: true
    }));

    // Simple sequential scheduling: fill days from Monday onwards
    jobsForWeek.forEach(job => {
      let remainingWork = job.estimated_minutes;
      
      // Fill available capacity starting from Monday
      for (let dayIndex = 0; dayIndex < dailySchedules.length && remainingWork > 0; dayIndex++) {
        const day = dailySchedules[dayIndex];
        
        if (day.availableCapacity > 0) {
          const workToAssign = Math.min(remainingWork, day.availableCapacity);
          
          const scheduledJob: ScheduledJob = {
            ...job,
            estimated_minutes: workToAssign,
            estimated_hours: Math.round(workToAssign / 60 * 100) / 100,
            scheduled_date: day.date
          };
          
          day.jobs.push(scheduledJob);
          day.availableCapacity -= workToAssign;
          day.total_minutes += workToAssign;
          day.total_hours = Math.round(day.total_minutes / 60 * 100) / 100;
          day.utilization = Math.round((day.total_minutes / DAILY_CAPACITY) * 100);
          
          remainingWork -= workToAssign;
        }
      }
    });

    // Calculate shifts for each day
    return dailySchedules.map(day => ({
      ...day,
      shifts: calculateDayShifts(day.jobs)
    }));
  }, [jobs, currentWeek]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    
    // Find the dragged job
    const job = weekSchedule
      .flatMap(day => day.jobs)
      .find(job => job.id === active.id);
    
    setDraggedJob(job || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || !draggedJob) {
      setActiveId(null);
      setDraggedJob(null);
      return;
    }

    const newDate = over.id as string;
    const oldDate = draggedJob.scheduled_date;

    if (newDate !== oldDate) {
      try {
        setIsLoading(true);
        
        // Update job due date in production_jobs table
        const { error } = await supabase
          .from('production_jobs')
          .update({
            due_date: newDate,
            updated_at: new Date().toISOString()
          })
          .eq('id', draggedJob.id);

        if (error) {
          throw error;
        }

        // Refresh the jobs data
        onRefresh();
        toast.success(`Job ${draggedJob.wo_no} rescheduled to ${format(new Date(newDate), 'MMM dd')}`);
      } catch (error) {
        console.error('Error rescheduling job:', error);
        toast.error('Failed to reschedule job');
      } finally {
        setIsLoading(false);
      }
    }

    setActiveId(null);
    setDraggedJob(null);
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 100) return 'text-destructive';
    if (utilization >= 80) return 'text-yellow-600';
    if (utilization >= 60) return 'text-blue-600';
    return 'text-green-600';
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = addDays(currentWeek, direction === 'next' ? 7 : -7);
    setCurrentWeek(newWeek);
  };

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const totalJobs = weekSchedule.reduce((sum, day) => sum + day.jobs.length, 0);
  const totalHours = weekSchedule.reduce((sum, day) => sum + day.total_hours, 0);
  const avgUtilization = weekSchedule.length > 0 
    ? Math.round(weekSchedule.reduce((sum, day) => sum + day.utilization, 0) / weekSchedule.length)
    : 0;

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Weekly Production Schedule
            {selectedStage && (
              <Badge variant="outline" className="ml-2">
                {selectedStage}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 mr-4">
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'cards' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('cards')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek('prev')}
              disabled={isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              Week of {format(weekStart, 'MMM dd, yyyy')}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek('next')}
              disabled={isLoading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Week Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{totalJobs}</div>
            <div className="text-sm text-muted-foreground">Jobs This Week</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{Math.round(totalHours)}h</div>
            <div className="text-sm text-muted-foreground">Total Hours</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${getUtilizationColor(avgUtilization)}`}>
              {avgUtilization}%
            </div>
            <div className="text-sm text-muted-foreground">Avg Utilization</div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm">Updating schedule...</span>
          </div>
        )}
        
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {viewMode === 'cards' ? (
            <div className="overflow-x-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {weekSchedule.map((day) => {
                  const dayDate = new Date(day.date);
                  const dayName = format(dayDate, 'EEE');
                  const dayNumber = format(dayDate, 'd');
                  
                  return (
                    <div key={day.date} className="min-h-[350px] w-full">
                      <DroppableDay
                        id={day.date}
                        day={day}
                        dayName={dayName}
                        dayNumber={dayNumber}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {weekSchedule.map((day) => {
                const dayDate = new Date(day.date);
                const dayName = format(dayDate, 'EEEE');
                const dayNumber = format(dayDate, 'MMM d');
                
                return (
                  <Card key={day.date} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          {dayName}, {dayNumber}
                        </CardTitle>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            {day.total_hours}h / {day.capacity_hours}h
                          </span>
                          <Badge 
                            variant={day.utilization >= 100 ? 'destructive' : 'secondary'}
                            className={getUtilizationColor(day.utilization)}
                          >
                            {day.utilization}%
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {day.jobs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No jobs scheduled
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {day.shifts.map((shift) => (
                            <div key={shift.shiftNumber} className="border rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-medium">
                                  Shift {shift.shiftNumber} ({shift.startTime} - {shift.endTime})
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {Math.round(shift.used / 60 * 100) / 100}h / {shift.capacity / 60}h
                                </div>
                              </div>
                              {shift.jobs.length === 0 ? (
                                <div className="text-xs text-muted-foreground py-2">No jobs</div>
                              ) : (
                                <div className="space-y-1">
                                  {shift.jobs.map((jobSegment, index) => (
                                    <div 
                                      key={`${jobSegment.jobId}-${index}`}
                                      className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm cursor-pointer hover:bg-muted/70"
                                      onClick={() => onJobClick(jobSegment.job.accessibleJob)}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">{jobSegment.job.wo_no}</span>
                                        <span className="text-muted-foreground">{jobSegment.job.customer}</span>
                                        {jobSegment.job.is_expedited && (
                                          <Badge variant="destructive" className="text-xs">Rush</Badge>
                                        )}
                                        {jobSegment.isPartial && (
                                          <Badge variant="outline" className="text-xs">Partial</Badge>
                                        )}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {Math.round(jobSegment.duration / 60 * 100) / 100}h
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <DragOverlay>
            {activeId && draggedJob ? (
              <DraggableJobCard
                job={draggedJob}
                isDragging
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </CardContent>
    </Card>
  );
};