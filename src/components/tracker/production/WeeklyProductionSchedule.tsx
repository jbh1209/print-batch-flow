import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, ChevronLeft, ChevronRight, List, Grid3X3, AlertTriangle, Table } from 'lucide-react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, addDays, startOfWeek } from 'date-fns';
import { DraggableJobCard } from '@/components/production/DraggableJobCard';
import { DroppableDay } from '@/components/production/DroppableDay';
import { WeeklyScheduleTable } from './WeeklyScheduleTable';
import { JobSpecificationCard } from '@/components/tracker/common/JobSpecificationCard';
import type { AccessibleJob } from '@/hooks/tracker/useAccessibleJobs';
import { type DynamicDaySchedule, type DynamicScheduledJob } from '@/services/dynamicProductionScheduler';
import { usePersistentSchedule } from '@/hooks/usePersistentSchedule';
import { ScheduleInitializationService } from '@/services/scheduleInitializationService';

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
  const [viewMode, setViewMode] = useState<'table' | 'list' | 'cards'>('table');
  const [weekSchedule, setWeekSchedule] = useState<DaySchedule[]>([]);
  
  // Schedule persistence
  const { loadSchedule, saveSchedule, updateJobPosition } = usePersistentSchedule();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Load database-persistent schedule ONLY - no dynamic generation
  useEffect(() => {
    const loadPersistentSchedule = async () => {
      if (!selectedStage) {
        setWeekSchedule([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });

      try {
        console.log(`📦 Loading persistent schedule for ${selectedStage}...`);
        
        // ONLY load from database - no dynamic generation
        const persistentSchedule = await loadSchedule(weekStart, selectedStage);
        
        if (persistentSchedule && persistentSchedule.length > 0) {
          console.log(`✅ Loaded persistent schedule with ${persistentSchedule.reduce((sum, day) => sum + day.jobs.length, 0)} jobs`);
          setWeekSchedule(persistentSchedule);
        } else {
          console.log(`📭 No persistent schedule found for ${selectedStage} - week ${weekStart.toISOString().split('T')[0]}`);
          setWeekSchedule([]);
          
          // Show user that no schedule exists
          toast.info('No schedule found for this week. Administrator needs to initialize schedules.');
        }
      } catch (error) {
        console.error('❌ Error loading persistent schedule:', error);
        toast.error('Failed to load production schedule');
        setWeekSchedule([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadPersistentSchedule();
  }, [currentWeek, selectedStage, loadSchedule]);

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

        // Update job position in persistent schedule
        const newDateObj = new Date(newDate);
        await updateJobPosition(draggedJob.id, selectedStage!, newDateObj, 1, 0);
        
        // Reload the persistent schedule after job update
        const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
        const updatedSchedule = await loadSchedule(weekStart, selectedStage!);
        if (updatedSchedule) {
          setWeekSchedule(updatedSchedule);
        }
        
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
            Production Schedule
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
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (confirm('Initialize schedules from current job data? This will create new schedules for all production stages.')) {
                  setIsLoading(true);
                  const success = await ScheduleInitializationService.initializeAllSchedules();
                  if (success) {
                    toast.success('Schedules initialized successfully');
                    // Reload current schedule
                    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
                    if (selectedStage) {
                      const schedule = await loadSchedule(weekStart, selectedStage);
                      if (schedule) setWeekSchedule(schedule);
                    }
                  } else {
                    toast.error('Failed to initialize schedules');
                  }
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
            >
              Initialize Schedules
            </Button>
            <div className="flex items-center gap-1 mr-4">
              <Button
                variant={viewMode === 'table' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('table')}
              >
                <Table className="h-4 w-4" />
              </Button>
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

      <CardContent className="h-[calc(100vh-400px)] overflow-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Loading schedule for {selectedStage}...</span>
          </div>
        )}

        {!selectedStage && !isLoading && (
          <div className="flex items-center justify-center py-16 text-center">
            <div>
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No Stage Selected</h3>
              <p className="text-muted-foreground">
                Select a production stage from the tracker to view the weekly schedule
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
            {viewMode === 'table' ? (
              <SortableContext 
                items={weekSchedule.flatMap(day => day.jobs.map(job => job.id))}
                strategy={verticalListSortingStrategy}
              >
                <WeeklyScheduleTable 
                  weekSchedule={weekSchedule}
                  onJobClick={onJobClick}
                />
              </SortableContext>
            ) : viewMode === 'cards' ? (
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
                                        className="cursor-pointer hover:bg-muted/70 rounded p-2"
                                        onClick={() => onJobClick(jobSegment.job.accessibleJob)}
                                      >
                                        <div className="flex items-center justify-between mb-2">
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
                                        <JobSpecificationCard
                                          jobId={jobSegment.job.id}
                                          jobTableName="production_jobs"
                                          compact={true}
                                          className="mt-1"
                                        />
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