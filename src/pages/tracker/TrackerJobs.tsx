
import React from "react";
import { ProductionManagerView } from "@/components/tracker/views/ProductionManagerView";
import AdminJobDeletion from "@/components/admin/AdminJobDeletion";

const TrackerJobs = () => {
  // Remove sidebar/layout wrappers here, so only main jobs manager UI is shown
  return (
    <div className="space-y-4">
      <AdminJobDeletion />
      <ProductionManagerView />
    </div>
  );
};

export default TrackerJobs;
