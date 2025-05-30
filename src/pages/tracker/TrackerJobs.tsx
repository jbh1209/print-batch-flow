
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Plus, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { JobsFilters } from "@/components/tracker/jobs/JobsFilters";
import { EnhancedJobsTable } from "@/components/tracker/jobs/EnhancedJobsTable";
import { useEnhancedProductionJobs } from "@/hooks/tracker/useEnhancedProductionJobs";

const TrackerJobs = () => {
  const { jobs, categories, isLoading, error, refreshJobs } = useEnhancedProductionJobs();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");

  // Filter jobs based on search, status, and category
  const filteredJobs = jobs.filter(job => {
    const matchesSearch = !searchQuery || 
      job.wo_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.customer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.reference?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "All" || 
      (statusFilter === "No Workflow" && !job.category_id) ||
      (statusFilter !== "No Workflow" && job.status === statusFilter);
    
    const matchesCategory = categoryFilter === "All" || 
      (categoryFilter === "No Category" && !job.category_id) ||
      job.category === categoryFilter;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Get unique statuses for filter
  const statuses = ["All", "No Workflow", ...Array.from(new Set(jobs.map(job => job.status)))];
  const categoryNames = ["All", "No Category", ...categories.map(cat => cat.name)];

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
          <h1 className="text-3xl font-bold">Enhanced Jobs Management</h1>
          <p className="text-gray-600">Manage jobs with full CRUD operations and workflow integration</p>
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
          <h1 className="text-3xl font-bold">Enhanced Jobs Management</h1>
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
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Enhanced Jobs Management</h1>
            <p className="text-gray-600">Manage jobs with full CRUD operations and workflow integration</p>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Import Jobs
            </Button>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Job
            </Button>
          </div>
        </div>
      </div>

      {/* Enhanced Filters */}
      <div className="mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Search</label>
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {statuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {categoryNames.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end">
            <Button 
              variant="outline" 
              onClick={refreshJobs}
              className="w-full"
            >
              Refresh
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>Total Jobs: {jobs.length}</span>
          <span>Filtered: {filteredJobs.length}</span>
          <span>Without Workflow: {jobs.filter(job => !job.category_id).length}</span>
          <span>In Workflow: {jobs.filter(job => job.category_id).length}</span>
        </div>
      </div>

      <EnhancedJobsTable
        jobs={filteredJobs}
        categories={categories}
        onJobUpdated={refreshJobs}
        onJobDeleted={refreshJobs}
        isLoading={isLoading}
      />

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
