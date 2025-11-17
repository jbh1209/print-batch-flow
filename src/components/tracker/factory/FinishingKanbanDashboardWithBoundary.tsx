import React from 'react';
import { TrackerErrorBoundary } from '../error-boundaries/TrackerErrorBoundary';
import { FinishingKanbanDashboard } from './FinishingKanbanDashboard';

export const FinishingKanbanDashboardWithBoundary: React.FC = () => {
  return (
    <TrackerErrorBoundary componentName="Finishing Dashboard">
      <FinishingKanbanDashboard />
    </TrackerErrorBoundary>
  );
};
