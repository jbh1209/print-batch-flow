import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardErrorBoundary } from '../error-boundaries/DashboardErrorBoundary';
import { PackagingShippingKanbanDashboard } from './PackagingShippingKanbanDashboard';

export const PackagingShippingKanbanDashboardWithBoundary: React.FC = () => {
  const navigate = useNavigate();

  const handleNavigateHome = () => {
    navigate('/tracker');
  };

  return (
    <DashboardErrorBoundary 
      dashboardName="Packaging & Shipping Dashboard"
      onNavigateHome={handleNavigateHome}
    >
      <PackagingShippingKanbanDashboard />
    </DashboardErrorBoundary>
  );
};
