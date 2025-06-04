
import React from 'react';
import { TrackerErrorBoundary } from '../error-boundaries/TrackerErrorBoundary';
import { JobErrorBoundary } from '../error-boundaries/JobErrorBoundary';
import { DtpKanbanColumn } from './DtpKanbanColumn';
import { AccessibleJob } from '@/hooks/tracker/useAccessibleJobs';

interface DtpKanbanColumnWithBoundaryProps {
  title: string;
  jobs: AccessibleJob[];
  onStart: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete: (jobId: string, stageId: string) => Promise<boolean>;
  onJobClick: (job: AccessibleJob) => void;
  colorClass: string;
  icon: React.ReactNode;
}

export const DtpKanbanColumnWithBoundary: React.FC<DtpKanbanColumnWithBoundaryProps> = (props) => {
  return (
    <TrackerErrorBoundary componentName={`DTP Kanban Column: ${props.title}`}>
      <DtpKanbanColumn {...props} />
    </TrackerErrorBoundary>
  );
};
