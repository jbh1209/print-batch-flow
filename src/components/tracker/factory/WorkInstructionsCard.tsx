
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface WorkInstructionsCardProps {
  job: AccessibleJob;
}

export const WorkInstructionsCard: React.FC<WorkInstructionsCardProps> = ({ job }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Work Instructions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-gray-700">
            Complete the {job.current_stage_name?.toLowerCase()} stage for this job. 
            Ensure all quality checks are performed according to standard procedures.
          </p>
          
          {job.current_stage_status === 'pending' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                <strong>Next step:</strong> Click "Start Job" to begin working on this stage.
              </p>
            </div>
          )}

          {job.current_stage_status === 'active' && (
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <p className="text-sm text-green-800">
                <strong>In progress:</strong> Complete your work and click "Complete Job" when finished.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
