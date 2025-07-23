
import React from "react";
import { ProductionManagerView } from "@/components/tracker/views/ProductionManagerView";

const TrackerJobs = () => {
  // Remove sidebar/layout wrappers here, so only main jobs manager UI is shown
  return <ProductionManagerView />;
};

export default TrackerJobs;
