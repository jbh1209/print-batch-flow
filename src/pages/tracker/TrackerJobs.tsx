
import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const TrackerJobs = () => {
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

      <div className="text-center py-12">
        <p className="text-gray-500">Jobs table view coming soon...</p>
        <p className="text-gray-400 text-sm mt-2">This will show all jobs in a filterable table format</p>
      </div>
    </div>
  );
};

export default TrackerJobs;
