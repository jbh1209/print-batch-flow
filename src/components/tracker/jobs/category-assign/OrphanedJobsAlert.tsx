
import React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Wrench } from "lucide-react";

interface OrphanedJobsAlertProps {
  orphanedJobs: string[];
  isAssigning: boolean;
  onRepairWorkflow: () => void;
}

export const OrphanedJobsAlert: React.FC<OrphanedJobsAlertProps> = ({
  orphanedJobs,
  isAssigning,
  onRepairWorkflow
}) => {
  if (orphanedJobs.length === 0) return null;

  return (
    <Alert className="border-yellow-200 bg-yellow-50">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="text-yellow-800">
        <div className="flex items-center justify-between">
          <span>
            {orphanedJobs.length} job(s) have categories but missing workflows. 
            This can cause assignment errors.
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onRepairWorkflow}
            disabled={isAssigning}
            className="ml-2 border-yellow-300 text-yellow-700 hover:bg-yellow-100"
          >
            <Wrench className="h-3 w-3 mr-1" />
            Repair
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};
