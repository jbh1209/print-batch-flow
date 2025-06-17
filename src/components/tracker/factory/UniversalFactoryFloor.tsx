
import React, { useState } from "react";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { DtpKanbanDashboard } from "./DtpKanbanDashboard";
import { ManagerDashboard } from "./ManagerDashboard";
import { EnhancedFactoryFloorDashboard } from "./EnhancedFactoryFloorDashboard";

export const UniversalFactoryFloor = () => {
  const { isDtpOperator, isManager } = useUserRole();

  // DTP operators get the specialized DTP Kanban dashboard
  if (isDtpOperator) {
    return <DtpKanbanDashboard />;
  }

  // Managers get the manager dashboard
  if (isManager) {
    return <ManagerDashboard />;
  }

  // Regular operators get the enhanced factory floor dashboard
  return <EnhancedFactoryFloorDashboard />;
};
