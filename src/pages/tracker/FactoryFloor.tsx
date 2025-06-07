
import React from "react";
import { SimpleJobsView } from "@/components/tracker/common/SimpleJobsView";

/**
 * Factory Floor page component - Simplified Version
 * 
 * Shows jobs organized by stage with simple, predictable actions.
 * No auto-advancement, clear manual control.
 */
const FactoryFloor = () => {
  return (
    <div className="min-h-screen bg-gray-50 w-full p-6">
      <SimpleJobsView
        title="Factory Floor"
        subtitle="Jobs organized by production stage"
        groupByStage={true}
      />
    </div>
  );
};

export default FactoryFloor;
