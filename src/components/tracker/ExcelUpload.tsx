
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { ExcelUpload as ExcelUploadComponent } from "@/components/tracker/ExcelUpload";
import { JobPartAssignmentManager } from "@/components/jobs/JobPartAssignmentManager";

const ExcelUpload = () => {
  const [showPartAssignment, setShowPartAssignment] = useState(false);
  const [importedJobIds, setImportedJobIds] = useState<string[]>([]);

  const handleEnhancedJobsConfirmed = (jobIds: string[]) => {
    console.log("Jobs created successfully:", jobIds);
    setImportedJobIds(jobIds);
    setShowPartAssignment(true);
  };

  const handlePartAssignmentClose = () => {
    setShowPartAssignment(false);
    setImportedJobIds([]);
  };

  return (
    <div className="w-full max-w-[95vw] mx-auto">
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

      <ExcelUploadComponent onEnhancedJobsConfirmed={handleEnhancedJobsConfirmed} />

      {/* Part Assignment Modal for newly imported jobs */}
      {showPartAssignment && importedJobIds.length > 0 && (
        <JobPartAssignmentManager
          jobId={importedJobIds[0]}
          jobTableName="production_jobs"
          open={showPartAssignment}
          onClose={handlePartAssignmentClose}
        />
      )}
    </div>
  );
};

export default ExcelUpload;
