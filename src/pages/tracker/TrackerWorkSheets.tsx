
import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const TrackerWorkSheets = () => {
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
        <h1 className="text-3xl font-bold">Work Sheet Generator</h1>
        <p className="text-gray-600">Generate printable work orders for selected jobs</p>
      </div>

      <div className="text-center py-12">
        <p className="text-gray-500">Work sheet generator coming soon...</p>
        <p className="text-gray-400 text-sm mt-2">This will allow you to select jobs and generate printable work orders</p>
      </div>
    </div>
  );
};

export default TrackerWorkSheets;
