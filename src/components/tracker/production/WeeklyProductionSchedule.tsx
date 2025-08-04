import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, ChevronLeft, ChevronRight, List, Grid3X3, AlertTriangle } from 'lucide-react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, addDays, startOfWeek } from 'date-fns';
import { DraggableJobCard } from '@/components/production/DraggableJobCard';
import { DroppableDay } from '@/components/production/DroppableDay';
import type { AccessibleJob } from '@/hooks/tracker/useAccessibleJobs';
import { dynamicProductionScheduler, type DynamicDaySchedule, type DynamicScheduledJob } from '@/services/dynamicProductionScheduler';

interface WeeklyProductionScheduleProps {
  jobs: AccessibleJob[];
  selectedStage?: string | null;
  onJobClick: (job: AccessibleJob) => void;
  onStageAction: (jobId: string, stageId: string, action: 'start' | 'complete' | 'qr-scan') => void;
  onRefresh: () => void;
}

// Use types from dynamic scheduler
type ScheduledJob = DynamicScheduledJob;
type DaySchedule = DynamicDaySchedule;

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
  const [weekSchedule, setWeekSchedule] = useState<DaySchedule[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Load dynamic schedule using the new scheduler
  useEffect(() => {
    const loadDynamicSchedule = async () => {
      if (!selectedStage) {
        setWeekSchedule([]);
        return;
      }

      try {
        setIsLoading(true);
        console.log(`🔄 Loading dynamic schedule for ${selectedStage}...`);
        
        const schedule = await dynamicProductionScheduler.generateWeeklySchedule({
          currentWeek,
          selectedStage,
          jobs
        });
        
        setWeekSchedule(schedule);
        console.log(`✅ Loaded schedule with ${schedule.length} days`);
      } catch (error) {
        console.error('❌ Error loading dynamic schedule:', error);
        toast.error('Failed to load production schedule');
        setWeekSchedule([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadDynamicSchedule();
  }, [jobs, currentWeek, selectedStage]);

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
            Dynamic Production Schedule
            {selectedStage ? (
              <Badge variant="outline" className="ml-2">
                {selectedStage}
              </Badge>
            ) : (
              <Badge variant="secondary" className="ml-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Select a stage
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
        {selectedStage && weekSchedule.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4">
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
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{selectedStage}</div>
              <div className="text-sm text-muted-foreground">Current Stage</div>
            </div>
          </div>
        )}

        {!selectedStage && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Please select a production stage to view the dynamic schedule</span>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Loading dynamic schedule for {selectedStage}...</span>
          </div>
        )}

        {!selectedStage && !isLoading && (
          <div className="flex items-center justify-center py-16 text-center">
            <div>
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No Stage Selected</h3>
              <p className="text-muted-foreground">
                Select a production stage from the tracker to view the dynamic weekly schedule
              </p>
            </div>
          </div>
        )}

        {selectedStage && !isLoading && weekSchedule.length === 0 && (
          <div className="flex items-center justify-center py-16 text-center">
            <div>
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No Jobs Found</h3>
              <p className="text-muted-foreground">
                No jobs are currently scheduled for {selectedStage} this week
              </p>
            </div>
          </div>
        )}
        
        {selectedStage && weekSchedule.length > 0 && (
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
                                          {jobSegment.job.queue_position && (
                                            <Badge variant="outline" className="text-xs">#{jobSegment.job.queue_position}</Badge>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-muted-foreground">
                                            {(jobSegment as any).start_time} - {(jobSegment as any).end_time}
                                          </span>
                                          <span className="text-xs text-muted-foreground">
                                            {Math.round(jobSegment.duration / 60 * 100) / 100}h
                                          </span>
                                          {jobSegment.isPartial && (
                                            <Badge variant="secondary" className="text-xs">Partial</Badge>
                                          )}
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
              {draggedJob && (
                <DraggableJobCard job={draggedJob} />
              )}
            </DragOverlay>
          </DndContext>
        )}
      </CardContent>
    </Card>
  );
};