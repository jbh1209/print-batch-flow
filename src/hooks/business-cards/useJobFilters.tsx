
import { useState } from "react";
import { JobStatus, LaminationType } from "@/components/business-cards/JobsTable";

export const useJobFilters = () => {
  const [filterView, setFilterView] = useState<JobStatus | "all">("all");
  const [laminationFilter, setLaminationFilter] = useState<LaminationType | "all">("all");
  const [filterCounts, setFilterCounts] = useState({
    all: 0,
    queued: 0,
    batched: 0,
    completed: 0
  });

  return {
    filterView,
    setFilterView,
    laminationFilter,
    setLaminationFilter,
    filterCounts,
    setFilterCounts,
  };
};
