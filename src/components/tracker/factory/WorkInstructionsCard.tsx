
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  FileText, 
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface WorkInstructionsCardProps {
  job: AccessibleJob;
}

export const WorkInstructionsCard: React.FC<WorkInstructionsCardProps> = ({ job }) => {
  // Mock work instructions based on stage name
  const getWorkInstructions = () => {
    const stageName = job.current_stage_name?.toLowerCase() || '';
    
    if (stageName.includes('dtp')) {
      return [
        "1. Review artwork files for print quality and resolution",
        "2. Check color profiles match customer requirements", 
        "3. Verify page setup and trim marks are correct",
        "4. Run test print to confirm colors and quality",
        "5. Begin full production run when approved"
      ];
    } else if (stageName.includes('proof')) {
      return [
        "1. Print proof copy using specified paper stock",
        "2. Check color accuracy against pantone guides",
        "3. Verify text is sharp and readable",
        "4. Check for any printing defects or issues",
        "5. Package proof securely for customer review"
      ];
    } else {
      return [
        "1. Follow standard operating procedures for this stage",
        "2. Check job specifications carefully",
        "3. Ensure quality standards are met",
        "4. Document any issues or deviations",
        "5. Complete stage requirements before marking as done"
      ];
    }
  };

  const instructions = getWorkInstructions();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Work Instructions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {instructions.map((instruction, index) => (
            <div key={index} className="flex items-start gap-3">
              <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
              <span className="text-sm text-gray-700">{instruction}</span>
            </div>
          ))}
        </div>

        {job.current_stage_status === 'pending' && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">
                Ready to Start
              </span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              Click "Start Job" when you're ready to begin working on this stage.
            </p>
          </div>
        )}

        {job.current_stage_status === 'active' && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                In Progress
              </span>
            </div>
            <p className="text-sm text-blue-700 mt-1">
              You're currently working on this job. Click "Complete Job" when finished.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
