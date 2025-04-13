
import { useNavigate } from "react-router-dom"; 
import JobsHeader from "@/components/business-cards/JobsHeader";
import StatusFilterTabs from "@/components/business-cards/StatusFilterTabs";
import JobsTableContainer from "@/components/business-cards/JobsTableContainer";
import FilterBar from "@/components/business-cards/FilterBar";
import { useBusinessCardJobsList } from "@/hooks/useBusinessCardJobsList";

const BusinessCardJobs = () => {
  const navigate = useNavigate();
  const { 
    jobs, 
    isLoading, 
    filterView, 
    filterCounts, 
    laminationFilter, 
    selectedJobs,
    setFilterView, 
    setLaminationFilter, 
    fetchJobs, 
    handleSelectJob, 
    handleSelectAllJobs,
    getSelectedJobObjects
  } = useBusinessCardJobsList();
  
  // Handle batch completion
  const handleBatchComplete = () => {
    fetchJobs(); // Refresh the jobs list
  };

  return (
    <div>
      <JobsHeader 
        title="All Business Card Jobs" 
        subtitle="View and manage all business card jobs" 
      />
      
      <div className="bg-white rounded-lg border shadow mb-8">
        {/* Tabs */}
        <StatusFilterTabs 
          filterView={filterView} 
          filterCounts={filterCounts} 
          setFilterView={setFilterView} 
        />
        
        {/* Filter Bar */}
        <FilterBar 
          laminationFilter={laminationFilter}
          setLaminationFilter={setLaminationFilter}
          selectedJobs={getSelectedJobObjects()}
          allAvailableJobs={jobs}
          onBatchComplete={handleBatchComplete}
          onSelectJob={handleSelectJob}
        />
        
        {/* Jobs Table */}
        <JobsTableContainer 
          jobs={jobs}
          isLoading={isLoading}
          onRefresh={fetchJobs}
          selectedJobs={selectedJobs}
          onSelectJob={handleSelectJob}
          onSelectAllJobs={handleSelectAllJobs}
        />
      </div>
    </div>
  );
};

export default BusinessCardJobs;
