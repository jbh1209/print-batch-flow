import React from 'react';
import { TrackerErrorBoundary } from '../error-boundaries/TrackerErrorBoundary';
import { ScoringKanbanDashboard } from './ScoringKanbanDashboard';

export const ScoringKanbanDashboardWithBoundary: React.FC = () => {
  return (
    <TrackerErrorBoundary componentName="Scoring Dashboard">
      <ScoringKanbanDashboard />
    </TrackerErrorBoundary>
  );
};
