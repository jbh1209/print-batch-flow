
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardErrorBoundary } from '../error-boundaries/DashboardErrorBoundary';
import { DtpKanbanDashboard } from './DtpKanbanDashboard';

export const DtpKanbanDashboardWithBoundary: React.FC = () => {
  const navigate = useNavigate();

  const handleNavigateHome = () => {
    navigate('/tracker');
  };

  return (
    <DashboardErrorBoundary 
      dashboardName="DTP Kanban Dashboard"
      onNavigateHome={handleNavigateHome}
    >
      <DtpKanbanDashboard />
    </DashboardErrorBoundary>
  );
};
