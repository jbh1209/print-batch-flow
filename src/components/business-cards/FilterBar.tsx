
import { LaminationType } from "@/components/business-cards/JobsTable";
import LaminationFilter from "@/components/business-cards/LaminationFilter";
import BatchControls from "@/components/business-cards/BatchControls";

interface FilterBarProps {
  laminationFilter: LaminationType | null;
  setLaminationFilter: (type: LaminationType | null) => void;
  selectedJobs: any[];
  allAvailableJobs: any[];
  onBatchComplete: () => void;
  onSelectJob: (jobId: string, isSelected: boolean) => void;
}

const FilterBar = ({
  laminationFilter,
  setLaminationFilter,
  selectedJobs,
  allAvailableJobs,
  onBatchComplete,
  onSelectJob
}: FilterBarProps) => {
  return (
    <div className="border-b border-t p-4 flex justify-between items-center flex-wrap gap-4">
      <LaminationFilter 
        laminationFilter={laminationFilter} 
        setLaminationFilter={setLaminationFilter} 
      />
      
      <BatchControls 
        selectedJobs={selectedJobs}
        allAvailableJobs={allAvailableJobs}
        onBatchComplete={onBatchComplete}
        onSelectJob={onSelectJob}
      />
    </div>
  );
};

export default FilterBar;
