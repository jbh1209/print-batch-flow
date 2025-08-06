import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, RefreshCw, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";

interface ScheduledJob {
  id: string;
  job_id: string;
  job_table_name: string;
  production_stage_id: string;
  scheduled_date: string;
  queue_position: number;
  estimated_duration_minutes: number;
  priority_score: number;
  is_expedited: boolean;
  status: string;
  production_jobs?: {
    id: string;
    wo_no: string;
    customer: string;
    status: string;
    proof_approved_at?: string;
    production_ready?: boolean;
    queue_calculated_due_date?: string;
  };
  production_stages?: {
    name: string;
    color: string;
  };
}

interface DailySchedule {
  id: string;
  date: string;
  production_stage_id: string;
  total_capacity_minutes: number;
  allocated_minutes: number;
  available_minutes: number;
  production_stages?: {
    name: string;
    color: string;
  };
}

interface ProductionScheduleCalendarProps {
  selectedWeek?: Date;
}

export const ProductionScheduleCalendar: React.FC<ProductionScheduleCalendarProps> = ({
  selectedWeek = new Date()
}) => {
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(selectedWeek, { weekStartsOn: 1 }));
  const [assignments, setAssignments] = useState<ScheduledJob[]>([]);
  const [dailySchedules, setDailySchedules] = useState<DailySchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);

  // Generate week days
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => addDays(currentWeek, index));
  }, [currentWeek]);

  // Load schedule data
  const loadScheduleData = useCallback(async () => {
    setIsLoading(true);
    try {
      const startDate = format(weekDays[0], 'yyyy-MM-dd');
      const endDate = format(weekDays[6], 'yyyy-MM-dd');

      const { data, error } = await supabase.functions.invoke('production-scheduler', {
        body: {
          action: 'get_schedule',
          data: { startDate, endDate }
        }
      });

      if (error) throw error;

      if (data.success) {
        setAssignments(data.assignments || []);
        setDailySchedules(data.dailySchedules || []);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error loading schedule data:', error);
      toast.error('Failed to load schedule data');
    } finally {
      setIsLoading(false);
    }
  }, [weekDays]);

  // Calculate schedules
  const calculateSchedules = useCallback(async () => {
    setIsCalculating(true);
    try {
      console.log('Starting schedule calculation process...');
      
      // First trigger due date calculations for all production-ready jobs
      const dueDateResponse = await supabase.functions.invoke('calculate-due-dates', {
        body: { 
          action: 'recalculate_all', 
          trigger_reason: 'Manual schedule calculation triggered'
        }
      });
      
      if (dueDateResponse.error) {
        console.warn('Due date calculation warning:', dueDateResponse.error);
      } else {
        console.log('Due dates calculated:', dueDateResponse.data);
        if (dueDateResponse.data?.success) {
          toast.success(`Updated due dates for ${dueDateResponse.data.jobs_processed} production-ready jobs`);
        }
      }

      // Then run regular calculation for the current week
      const startDate = format(weekDays[0], 'yyyy-MM-dd');
      const endDate = format(weekDays[6], 'yyyy-MM-dd');

      const { data, error } = await supabase.functions.invoke('production-scheduler', {
        body: {
          action: 'calculate',
          data: { startDate, endDate, calculationType: 'nightly_full' }
        }
      });

      if (error) throw error;

      if (data.success) {
        const result = data.result;
        const workingHours = result.working_hours_info;
        toast.success(`Scheduled ${result.jobs_processed} jobs across ${result.stages_affected} stages (${workingHours?.working_days}, ${workingHours?.working_hours})`);
        await loadScheduleData(); // Reload to see changes
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error calculating schedules:', error);
      toast.error('Failed to calculate schedules');
    } finally {
      setIsCalculating(false);
    }
  }, [weekDays, loadScheduleData]);

  // Handle drag and drop
  const handleDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination) return;

    const sourceDate = result.source.droppableId;
    const destinationDate = result.destination.droppableId;
    const jobIndex = result.source.index;

    if (sourceDate === destinationDate) return; // Same date, no change

    const sourceJobs = assignments.filter(job => job.scheduled_date === sourceDate);
    const draggedJob = sourceJobs[jobIndex];

    if (!draggedJob) return;

    try {
      const { data, error } = await supabase.functions.invoke('production-scheduler', {
        body: {
          action: 'reschedule',
          data: {
            jobId: draggedJob.job_id,
            jobTableName: draggedJob.job_table_name,
            productionStageId: draggedJob.production_stage_id,
            newDate: destinationDate,
            newQueuePosition: result.destination.index + 1,
            reason: 'Drag and drop reschedule'
          }
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Job rescheduled to ${format(new Date(destinationDate), 'MMM d')}`);
        await loadScheduleData(); // Reload to see changes
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error rescheduling job:', error);
      toast.error('Failed to reschedule job');
    }
  }, [assignments, loadScheduleData]);

  // Get jobs for a specific date
  const getJobsForDate = useCallback((date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return assignments
      .filter(job => job.scheduled_date === dateKey)
      .sort((a, b) => a.queue_position - b.queue_position);
  }, [assignments]);

  // Get capacity info for a date
  const getCapacityForDate = useCallback((date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const daySchedules = dailySchedules.filter(schedule => schedule.date === dateKey);
    
    const totalCapacity = daySchedules.reduce((sum, schedule) => sum + schedule.total_capacity_minutes, 0);
    const totalAllocated = daySchedules.reduce((sum, schedule) => sum + schedule.allocated_minutes, 0);
    
    return {
      totalCapacity,
      totalAllocated,
      utilization: totalCapacity > 0 ? Math.round((totalAllocated / totalCapacity) * 100) : 0
    };
  }, [dailySchedules]);

  // Navigation
  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = addDays(currentWeek, direction === 'next' ? 7 : -7);
    setCurrentWeek(newWeek);
  };

  // Load data when week changes
  useEffect(() => {
    loadScheduleData();
  }, [loadScheduleData]);

  // Auto-populate initial schedules if none exist
  useEffect(() => {
    const autoPopulate = async () => {
      if (assignments.length === 0 && dailySchedules.length === 0 && !isLoading) {
        console.log('No schedules found, auto-populating...');
        try {
          const { data, error } = await supabase.functions.invoke('production-scheduler', {
            body: { action: 'populate_initial' }
          });
          
          if (data?.success) {
            console.log('Auto-population successful:', data.result);
            toast.success(`Auto-populated ${data.result?.jobs_processed || 0} jobs into schedule`);
            setTimeout(() => loadScheduleData(), 1000); // Reload after brief delay
          }
        } catch (error) {
          console.error('Auto-populate error:', error);
        }
      }
    };
    
    autoPopulate();
  }, [assignments.length, dailySchedules.length, isLoading, loadScheduleData]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            <span>Loading production schedule...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Production Schedule
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={calculateSchedules}
                disabled={isCalculating}
              >
                {isCalculating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Calculate
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigateWeek('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium px-3">
                Week of {format(currentWeek, 'MMM d, yyyy')}
              </span>
              <Button variant="outline" size="sm" onClick={() => navigateWeek('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Weekly Calendar Grid */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-7 gap-4">
          {weekDays.map((day, index) => {
            const dayJobs = getJobsForDate(day);
            const capacity = getCapacityForDate(day);
            const isToday = isSameDay(day, new Date());
            const dateKey = format(day, 'yyyy-MM-dd');
            
            return (
              <Card key={index} className={`min-h-[400px] ${isToday ? 'ring-2 ring-primary' : ''}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">
                    {format(day, 'EEE')}
                    <br />
                    {format(day, 'MMM d')}
                  </CardTitle>
                  <div className="space-y-1">
                    {dayJobs.length > 0 && (
                      <Badge variant="secondary" className="w-fit">
                        {dayJobs.length} job{dayJobs.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                    {capacity.totalCapacity > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>{Math.round(capacity.totalCapacity / 60)}h capacity</span>
                          <span className={`font-medium ${
                            capacity.utilization > 100 ? 'text-red-500' : 
                            capacity.utilization > 80 ? 'text-amber-500' : 
                            'text-green-500'
                          }`}>
                            {capacity.utilization}%
                          </span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-1 mt-1">
                          <div 
                            className={`h-1 rounded-full transition-all ${
                              capacity.utilization > 100 ? 'bg-red-500' : 
                              capacity.utilization > 80 ? 'bg-amber-500' : 
                              'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(capacity.utilization, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardHeader>
                
                <Droppable droppableId={dateKey}>
                  {(provided, snapshot) => (
                    <CardContent 
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`space-y-2 min-h-[200px] ${
                        snapshot.isDraggingOver ? 'bg-accent/50' : ''
                      }`}
                    >
                      {dayJobs.map((job, jobIndex) => (
                        <Draggable 
                          key={job.id} 
                          draggableId={job.id} 
                          index={jobIndex}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`p-2 rounded border transition-colors cursor-move ${
                                snapshot.isDragging ? 'shadow-lg bg-background' :
                                job.is_expedited ? 'bg-red-50 border-red-200 hover:bg-red-100' :
                                job.priority_score < 50 ? 'bg-amber-50 border-amber-200 hover:bg-amber-100' : 
                                'bg-card hover:bg-accent'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-1">
                                <span className="font-medium text-sm">
                                  {job.production_jobs?.wo_no || 'Unknown Job'}
                                </span>
                                <div className="flex items-center gap-1">
                                  <Badge variant="outline" className="text-xs">
                                    #{job.queue_position}
                                  </Badge>
                                  {job.is_expedited && (
                                    <AlertTriangle className="h-3 w-3 text-red-500" />
                                  )}
                                </div>
                              </div>
                              
                              <div className="text-xs text-muted-foreground mb-1">
                                {job.production_jobs?.customer || 'Unknown Customer'}
                              </div>
                              
                              <div className="flex items-center gap-1 text-xs">
                                <Clock className="h-3 w-3" />
                                <span>{job.production_stages?.name || 'Unknown Stage'}</span>
                                <span className="text-muted-foreground">
                                  ({Math.round(job.estimated_duration_minutes / 60)}h)
                                </span>
                              </div>
                              
                              <Badge 
                                variant={job.status === 'scheduled' ? 'secondary' : 'default'}
                                className="text-xs mt-1"
                              >
                                {job.status}
                              </Badge>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      
                      {provided.placeholder}
                      
                      {/* Empty state for days with no jobs */}
                      {dayJobs.length === 0 && (
                        <div className="text-center text-muted-foreground text-sm py-8">
                          No jobs scheduled
                          <br />
                          <span className="text-xs">Drop jobs here to schedule</span>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Droppable>
              </Card>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
};