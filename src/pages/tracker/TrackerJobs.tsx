
import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Upload } from "lucide-react";
import { Link, useOutletContext } from "react-router-dom";
import { ResponsiveJobsTable } from "@/components/tracker/jobs/ResponsiveJobsTable";

interface TrackerJobsContext {
  activeTab: string;
  filters: any;
}

const TrackerJobs = () => {
  const context = useOutletContext<TrackerJobsContext>();
  const filters = context?.filters || {};

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header - Responsive */}
      <div className="bg-white border-b px-4 sm:px-6 py-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/tracker" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Dashboard</span>
                <span className="sm:hidden">Back</span>
              </Link>
            </Button>
            
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Jobs Management</h1>
              <p className="text-gray-600 text-sm sm:text-base hidden sm:block">
                View and manage all production jobs with enhanced workflow tracking
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
              <Link to="/tracker/upload">
                <Upload className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Import Excel</span>
                <span className="sm:hidden">Import</span>
              </Link>
            </Button>
            <Button size="sm" className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Job
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - Responsive */}
      <div className="flex-1 p-4 sm:p-6 overflow-auto">
        <ResponsiveJobsTable filters={filters} />
      </div>
    </div>
  );
};

export default TrackerJobs;
