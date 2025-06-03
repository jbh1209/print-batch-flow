
import React from "react";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { FactoryFloorView } from "@/components/tracker/views/FactoryFloorView";

export const OperatorDashboard = () => {
  const { isDtpOperator, accessibleStages } = useUserRole();

  // Filter stages for DTP operators - only show DTP and Proof stages
  const relevantStageIds = isDtpOperator 
    ? accessibleStages
        .filter(stage => 
          stage.stage_name.toLowerCase().includes('dtp') || 
          stage.stage_name.toLowerCase().includes('proof')
        )
        .map(stage => stage.stage_id)
    : accessibleStages.map(stage => stage.stage_id);

  return (
    <FactoryFloorView 
      stageFilter={relevantStageIds.length > 0 ? relevantStageIds[0] : null}
      isDtpOperator={isDtpOperator}
    />
  );
};
