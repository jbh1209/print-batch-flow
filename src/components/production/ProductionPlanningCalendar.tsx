import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, Clock, Users, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ProductionScheduler } from '@/services/productionScheduler';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DraggableJobCard } from './DraggableJobCard';
import { DroppableDay } from './DroppableDay';
import { format, addDays, startOfWeek } from 'date-fns';

interface ScheduledJob {
  id: string;
  wo_no: string;
  customer: string;
  status: string;
  estimated_hours: number;
  scheduled_date: string;
  priority: number;
  category_name?: string;
  is_expedited: boolean;
  current_stage?: string;
}

interface DaySchedule {
  date: string;
  jobs: ScheduledJob[];
  total_hours: number;
  capacity_hours: number;
  utilization: number;
  is_working_day: boolean;
}

export const ProductionPlanningCalendar: React.FC = () => {
  const [weekSchedule, setWeekSchedule] = useState<DaySchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedJob, setDraggedJob] = useState<ScheduledJob | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const loadWeekSchedule = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
      const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
      
      const schedulePromises = weekDays.map(async (date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        
        // Get production jobs due on this day or nearby
        const { data: jobs, error: jobsError } = await supabase
          .from('production_jobs')
          .select(`
            id,
            wo_no,
            customer,
            status,
            is_expedited,
            qty,
            due_date,
            categories:category_id (
              name
            )
          `)
          .eq('due_date', dateStr)
          .neq('status', 'completed')
          .order('wo_no');

        if (jobsError) {
          console.error('Error loading jobs:', jobsError);
          return {
            date: dateStr,
            jobs: [],
            total_hours: 0,
            capacity_hours: 8,
            utilization: 0,
            is_working_day: true
          };
        }

        // Get current stage for each job
        const jobsWithStages = await Promise.all((jobs || []).map(async (job: any) => {
          const { data: currentStage } = await supabase
            .from('job_stage_instances')
            .select(`
              production_stages:production_stage_id (name)
            `)
            .eq('job_id', job.id)
            .eq('job_table_name', 'production_jobs')
            .eq('status', 'active')
            .single();

          return {
            id: job.id,
            wo_no: job.wo_no || 'Unknown',
            customer: job.customer || 'Unknown',
            status: job.status || 'Unknown',
            estimated_hours: Math.max(8, (job.qty || 100) / 50), // Rough estimate based on quantity
            scheduled_date: dateStr,
            priority: job.is_expedited ? 1 : 100,
            category_name: job.categories?.name,
            is_expedited: job.is_expedited || false,
            current_stage: currentStage?.production_stages?.name || 'Pre-Press'
          };
        }));

        const total_hours = jobsWithStages.reduce((sum, job) => sum + job.estimated_hours, 0);
        const utilization = Math.round((total_hours / 8) * 100);

        return {
          date: dateStr,
          jobs: jobsWithStages,
          total_hours,
          capacity_hours: 8,
          utilization,
          is_working_day: true
        };
      });

      const schedule = await Promise.all(schedulePromises);
      setWeekSchedule(schedule);
    } catch (error) {
      console.error('Error loading week schedule:', error);
      toast.error('Failed to load production schedule');
    } finally {
      setIsLoading(false);
    }
  }, [currentWeek]);

  useEffect(() => {
    loadWeekSchedule();
  }, [loadWeekSchedule]);

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

        // Reload schedule to reflect changes
        await loadWeekSchedule();
        toast.success(`Job ${draggedJob.wo_no} rescheduled to ${format(new Date(newDate), 'MMM dd')}`);
      } catch (error) {
        console.error('Error rescheduling job:', error);
        toast.error('Failed to reschedule job');
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Production Planning Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading production schedule...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const totalJobs = weekSchedule.reduce((sum, day) => sum + day.jobs.length, 0);
  const totalHours = weekSchedule.reduce((sum, day) => sum + day.total_hours, 0);
  const avgUtilization = weekSchedule.length > 0 
    ? Math.round(weekSchedule.reduce((sum, day) => sum + day.utilization, 0) / weekSchedule.length)
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Production Planning Calendar
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek('prev')}
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
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Week Summary */}
        <div className="grid grid-cols-3 gap-4 mt-4">
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
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-5 gap-4">
            {weekSchedule.map((day) => {
              const dayDate = new Date(day.date);
              const dayName = format(dayDate, 'EEE');
              const dayNumber = format(dayDate, 'd');
              
              return (
                <DroppableDay
                  key={day.date}
                  id={day.date}
                  day={day}
                  dayName={dayName}
                  dayNumber={dayNumber}
                />
              );
            })}
          </div>

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