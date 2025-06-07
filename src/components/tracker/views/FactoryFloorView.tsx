
import React from "react";
import { SimpleJobsView } from "@/components/tracker/common/SimpleJobsView";

interface FactoryFloorViewProps {
  stageFilter?: string | null;
  isDtpOperator?: boolean;
}

export const FactoryFloorView: React.FC<FactoryFloorViewProps> = ({ 
  stageFilter, 
  isDtpOperator = false 
}) => {
  const getTitle = () => {
    if (isDtpOperator) return "DTP & Proofing Jobs";
    return "Factory Floor";
  };

  const getSubtitle = () => {
    if (isDtpOperator) return "Jobs ready for DTP and proofing work";
    return "Jobs you can work on";
  };

  return (
    <div className="p-6">
      <SimpleJobsView
        stageFilter={stageFilter || undefined}
        title={getTitle()}
        subtitle={getSubtitle()}
        groupByStage={true}
      />
    </div>
  );
};
