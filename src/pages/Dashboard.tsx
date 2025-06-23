
import React from "react";
import TrackerDashboard from "./tracker/TrackerDashboard";
import { ProductionDataProvider } from "@/contexts/ProductionDataContext";

// Wrap dashboard with ProductionDataProvider to reuse cached data
export default function Dashboard() {
  return (
    <ProductionDataProvider>
      <TrackerDashboard />
    </ProductionDataProvider>
  );
}
