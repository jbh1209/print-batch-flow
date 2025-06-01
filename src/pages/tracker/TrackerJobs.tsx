
import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, Download, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { EnhancedJobsTableWithBulkActions } from "@/components/tracker/jobs/EnhancedJobsTableWithBulkActions";

const TrackerJobs = () => {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6 flex-shrink-0">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/tracker" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
        
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold">Jobs Management</h1>
            <p className="text-gray-600 text-sm sm:text-base">
              View and manage all production jobs with enhanced workflow tracking
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/tracker/upload" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Import Excel
              </Link>
            </Button>
            
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Job
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <EnhancedJobsTableWithBulkActions />
      </div>
    </div>
  );
};

export default TrackerJobs;
