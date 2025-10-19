import React from "react";
import { DieCuttingKanbanView } from "@/components/tracker/factory/DieCuttingKanbanView";
import { useIsManagement } from "@/hooks/tracker/useIsManagement";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { Navigate } from "react-router-dom";

const DieCuttingManager = () => {
  const { isAdmin, isManager, isLoading: roleLoading } = useUserRole();
  const { isManagement, isLoading: groupLoading } = useIsManagement();

  console.debug('DieCuttingManager: Access check', {
    isAdmin,
    isManager,
    isManagement,
    roleLoading,
    groupLoading
  });

  // Show loading state
  if (roleLoading || groupLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Check authorization - must be admin, manager, or in Management group
  const hasAccess = isAdmin || isManager || isManagement;

  if (!hasAccess) {
    console.warn('DieCuttingManager: Access denied');
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md p-6 bg-destructive/10 rounded-lg">
          <h2 className="text-xl font-semibold text-destructive mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">
            You do not have permission to access the Die Cutting Manager.
            This area is restricted to Management group members, managers, and administrators.
          </p>
          <Navigate to="/tracker/factory-floor" replace />
        </div>
      </div>
    );
  }

  console.debug('DieCuttingManager: Access granted, rendering kanban view');
  
  return <DieCuttingKanbanView />;
};

export default DieCuttingManager;
