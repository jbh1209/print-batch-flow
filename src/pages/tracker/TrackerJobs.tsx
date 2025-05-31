
import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Upload } from "lucide-react";
import { Link, useOutletContext } from "react-router-dom";
import { EnhancedJobsTableView } from "@/components/tracker/jobs/EnhancedJobsTableView";

interface TrackerJobsContext {
  activeTab: string;
  filters: any;
}

const TrackerJobs = () => {
  const context = useOutletContext<TrackerJobsContext>();
  const filters = context?.filters || {};

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 flex-shrink-0">
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
            <h1 className="text-3xl font-bold">Jobs Management</h1>
            <p className="text-gray-600">View and manage all production jobs with enhanced workflow tracking</p>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/tracker/upload">
                <Upload className="mr-2 h-4 w-4" />
                Import Excel
              </Link>
            </Button>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Job
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <EnhancedJobsTableView filters={filters} />
      </div>
    </div>
  );
};

export default TrackerJobs;
