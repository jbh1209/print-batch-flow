import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Clock, Zap, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { JobSpecificationCard } from '@/components/tracker/common/JobSpecificationCard';
import type { DynamicDaySchedule, DynamicScheduledJob } from '@/services/dynamicProductionScheduler';
import type { AccessibleJob } from '@/hooks/tracker/useAccessibleJobs';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface WeeklyScheduleTableProps {
  weekSchedule: DynamicDaySchedule[];
  onJobClick: (job: AccessibleJob) => void;
}

interface DraggableTableRowProps {
  job: DynamicScheduledJob;
  dayName: string;
  dayDate: string;
  shiftNumber: number;
  startTime: string;
  endTime: string;
  duration: number;
  onJobClick: (job: AccessibleJob) => void;
}

const DraggableTableRow: React.FC<DraggableTableRowProps> = ({
  job,
  dayName,
  dayDate,
  shiftNumber,
  startTime,
  endTime,
  duration,
  onJobClick
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: job.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getPriorityColor = (priority: number, isExpedited: boolean) => {
    if (isExpedited) return 'text-red-600';
    if (priority <= 50) return 'text-orange-600';
    if (priority <= 75) return 'text-yellow-600';
    return 'text-blue-600';
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing hover:bg-muted/50"
      onClick={() => onJobClick(job.accessibleJob)}
    >
      <TableCell className="font-medium">
        {format(new Date(dayDate), 'EEE MMM d')}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-medium">{job.wo_no}</span>
          {job.is_expedited && <Zap className="h-3 w-3 text-red-500" />}
          {job.priority <= 50 && !job.is_expedited && (
            <AlertTriangle className="h-3 w-3 text-orange-500" />
          )}
        </div>
      </TableCell>
      <TableCell className="max-w-[150px] truncate">{job.customer}</TableCell>
      <TableCell>
        <JobSpecificationCard
          jobId={job.id}
          jobTableName="production_jobs"
          compact={true}
          className="max-w-[200px]"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-sm">
          <Clock className="h-3 w-3" />
          {Math.round(duration / 60 * 100) / 100}h
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Shift {shiftNumber}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {startTime} - {endTime}
          </span>
        </div>
      </TableCell>
      <TableCell>
        {job.queue_position && (
          <Badge variant="secondary" className="text-xs">
            #{job.queue_position}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <Badge 
          variant={job.is_expedited ? 'destructive' : 'secondary'}
          className={getPriorityColor(job.priority, job.is_expedited)}
        >
          {job.status}
        </Badge>
      </TableCell>
    </TableRow>
  );
};

export const WeeklyScheduleTable: React.FC<WeeklyScheduleTableProps> = ({
  weekSchedule,
  onJobClick
}) => {
  // Flatten all jobs from all days and shifts
  const allJobs = weekSchedule.flatMap(day =>
    day.shifts.flatMap(shift =>
      shift.jobs.map(jobSegment => ({
        ...jobSegment.job,
        dayName: format(new Date(day.date), 'EEEE'),
        dayDate: day.date,
        shiftNumber: shift.shiftNumber,
        startTime: shift.startTime,
        endTime: shift.endTime,
        duration: jobSegment.duration
      }))
    )
  );

  if (allJobs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No jobs scheduled for this week
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Day</TableHead>
            <TableHead>Job #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Paper Specs</TableHead>
            <TableHead>Hours</TableHead>
            <TableHead>Time Slot</TableHead>
            <TableHead>Queue</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allJobs.map((job, index) => (
            <DraggableTableRow
              key={`${job.id}-${job.shiftNumber}-${index}`}
              job={job}
              dayName={job.dayName}
              dayDate={job.dayDate}
              shiftNumber={job.shiftNumber}
              startTime={job.startTime}
              endTime={job.endTime}
              duration={job.duration}
              onJobClick={onJobClick}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
};