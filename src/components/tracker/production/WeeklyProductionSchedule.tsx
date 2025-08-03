import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
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
  scheduled_date: string;
  priority: number;
  is_expedited: boolean;
  current_stage?: string;
  accessibleJob: AccessibleJob;
}

interface DaySchedule {
  date: string;
  jobs: ScheduledJob[];
  total_hours: number;
  capacity_hours: number;
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Create weekly schedule from filtered jobs
  const weekSchedule = useMemo(() => {
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
    const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
    
    return weekDays.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // Filter jobs for this day
      const dayJobs = jobs
        .filter(job => {
          if (!job.due_date) return false;
          return isSameDay(new Date(job.due_date), date);
        })
        .map(job => ({
          id: job.job_id,
          wo_no: job.wo_no || 'Unknown',
          customer: job.customer || 'Unknown',
          status: job.status || 'Unknown',
          estimated_hours: Math.max(4, (job.qty || 100) / 100), // Rough estimate
          scheduled_date: dateStr,
          priority: (job as any).is_expedited ? 1 : 100,
          is_expedited: (job as any).is_expedited || false,
          current_stage: job.display_stage_name,
          accessibleJob: job
        }));

      const total_hours = dayJobs.reduce((sum, job) => sum + job.estimated_hours, 0);
      const capacity_hours = 8; // Standard workday
      const utilization = Math.round((total_hours / capacity_hours) * 100);

      return {
        date: dateStr,
        jobs: dayJobs,
        total_hours,
        capacity_hours,
        utilization,
        is_working_day: true
      };
    });
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
          <div className="grid grid-cols-5 gap-4">
            {weekSchedule.map((day) => {
              const dayDate = new Date(day.date);
              const dayName = format(dayDate, 'EEE');
              const dayNumber = format(dayDate, 'd');
              
              return (
                <div key={day.date} className="min-h-[300px]">
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