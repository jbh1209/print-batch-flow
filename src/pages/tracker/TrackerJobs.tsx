
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useProductionJobs } from "@/hooks/useProductionJobs";
import { JobsFilters } from "@/components/tracker/jobs/JobsFilters";
import { JobsTableView } from "@/components/tracker/jobs/JobsTableView";

const TrackerJobs = () => {
  const { jobs, isLoading, error } = useProductionJobs();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // Filter jobs based on search and status
  const filteredJobs = jobs.filter(job => {
    const matchesSearch = !searchQuery || 
      job.wo_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.customer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.reference?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "All" || job.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="container mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/tracker" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold">Jobs Table</h1>
          <p className="text-gray-600">View and manage all production jobs in table format</p>
        </div>

        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading jobs...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/tracker" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold">Jobs Table</h1>
        </div>

        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
          <p className="font-medium">Error loading jobs</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/tracker" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
        <h1 className="text-3xl font-bold">Jobs Table</h1>
        <p className="text-gray-600">View and manage all production jobs in table format</p>
      </div>

      <JobsFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        totalJobs={jobs.length}
        filteredJobs={filteredJobs.length}
      />

      <JobsTableView jobs={filteredJobs} />

      {jobs.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg mb-4">No jobs found</p>
          <p className="text-gray-400 text-sm mb-6">Upload an Excel file to start tracking jobs</p>
          <Button asChild>
            <Link to="/tracker/upload">Upload Excel File</Link>
          </Button>
        </div>
      )}
    </div>
  );
};

export default TrackerJobs;
