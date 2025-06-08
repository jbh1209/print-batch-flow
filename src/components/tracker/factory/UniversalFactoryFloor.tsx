
import React, { useState } from "react";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { DtpKanbanDashboard } from "./DtpKanbanDashboard";
import { ManagerDashboard } from "./ManagerDashboard";
import { FactoryFloorView } from "../views/FactoryFloorView";

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

  // Regular operators get the factory floor view
  return <FactoryFloorView />;
};
