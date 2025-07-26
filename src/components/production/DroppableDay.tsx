import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DraggableJobCard } from './DraggableJobCard';

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

interface DroppableDayProps {
  id: string;
  day: DaySchedule;
  dayName: string;
  dayNumber: string;
}

export const DroppableDay: React.FC<DroppableDayProps> = ({ id, day, dayName, dayNumber }) => {
  const { isOver, setNodeRef } = useDroppable({ id });

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 100) return 'bg-red-500';
    if (utilization >= 80) return 'bg-yellow-500';
    if (utilization >= 60) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getUtilizationBadge = (utilization: number) => {
    if (utilization >= 100) return 'destructive';
    if (utilization >= 80) return 'secondary';
    return 'default';
  };

  return (
    <Card
      ref={setNodeRef}
      className={`min-h-[400px] transition-colors ${
        isOver ? 'bg-primary/5 border-primary' : ''
      }`}
    >
      <CardHeader className="pb-2">
        {/* Day Header */}
        <div className="text-center">
          <div className="text-lg font-bold">{dayNumber}</div>
          <div className="text-sm text-muted-foreground">{dayName}</div>
        </div>

        {/* Capacity Indicator */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span>{Math.round(day.total_hours)}h / {day.capacity_hours}h</span>
            <Badge variant={getUtilizationBadge(day.utilization)} className="text-xs">
              {day.utilization}%
            </Badge>
          </div>
          <div className="w-full bg-secondary rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${getUtilizationColor(day.utilization)}`}
              style={{ width: `${Math.min(day.utilization, 100)}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <SortableContext items={day.jobs.map(job => job.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {day.jobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No jobs scheduled
              </div>
            ) : (
              day.jobs.map((job) => (
                <DraggableJobCard key={job.id} job={job} />
              ))
            )}
          </div>
        </SortableContext>
      </CardContent>
    </Card>
  );
};