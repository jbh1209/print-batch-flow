
import React from "react";
import { ProductionManagerView } from "@/components/tracker/views/ProductionManagerView";

const TrackerJobs = () => {
  // Remove sidebar/layout wrappers here, so only main jobs manager UI is shown
  return (
    <div className="space-y-4">
      <ProductionManagerView />
    </div>
  );
};

export default TrackerJobs;
