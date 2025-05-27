
import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { ExcelUpload } from "@/components/tracker/ExcelUpload";

const TrackerUpload = () => {
  return (
    <div className="container mx-auto max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/tracker" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
        <h1 className="text-3xl font-bold">Upload Production Jobs</h1>
        <p className="text-gray-600">Import production jobs from Excel files</p>
      </div>

      <ExcelUpload />
    </div>
  );
};

export default TrackerUpload;
