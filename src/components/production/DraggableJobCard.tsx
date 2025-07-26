import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, Zap } from 'lucide-react';

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

interface DraggableJobCardProps {
  job: ScheduledJob;
  isDragging?: boolean;
}

export const DraggableJobCard: React.FC<DraggableJobCardProps> = ({ job, isDragging = false }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: job.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  const getPriorityColor = (priority: number, isExpedited: boolean) => {
    if (isExpedited) return 'bg-red-100 border-red-300 text-red-800';
    if (priority <= 50) return 'bg-orange-100 border-orange-300 text-orange-800';
    if (priority <= 75) return 'bg-yellow-100 border-yellow-300 text-yellow-800';
    return 'bg-blue-100 border-blue-300 text-blue-800';
  };

  const getEstimateColor = (hours: number) => {
    if (hours >= 6) return 'text-red-600';
    if (hours >= 4) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-3 cursor-grab active:cursor-grabbing border transition-all hover:shadow-md ${
        isDragging ? 'shadow-lg' : ''
      } ${getPriorityColor(job.priority, job.is_expedited)}`}
    >
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="font-semibold text-sm truncate">{job.wo_no}</div>
          <div className="flex items-center gap-1">
            {job.is_expedited && (
              <Zap className="h-3 w-3 text-red-500" />
            )}
            {job.priority <= 50 && !job.is_expedited && (
              <AlertTriangle className="h-3 w-3 text-orange-500" />
            )}
          </div>
        </div>

        {/* Customer */}
        <div className="text-xs text-muted-foreground truncate">
          {job.customer}
        </div>

        {/* Category & Stage */}
        {(job.category_name || job.current_stage) && (
          <div className="flex gap-1">
            {job.category_name && (
              <Badge variant="secondary" className="text-xs px-1 py-0">
                {job.category_name}
              </Badge>
            )}
            {job.current_stage && (
              <Badge variant="outline" className="text-xs px-1 py-0">
                {job.current_stage}
              </Badge>
            )}
          </div>
        )}

        {/* Timing */}
        <div className="flex items-center gap-1 text-xs">
          <Clock className="h-3 w-3" />
          <span className={getEstimateColor(job.estimated_hours)}>
            {job.estimated_hours}h
          </span>
        </div>

        {/* Status */}
        <div className="text-xs font-medium">
          {job.status}
        </div>
      </div>
    </Card>
  );
};