
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export const FlyerJobsEmptyState = () => {
  const navigate = useNavigate();
  
  return (
    <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg border border-dashed border-gray-300 p-8">
      <FileText className="h-12 w-12 text-gray-400 mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-1">No flyer jobs found</h3>
      <p className="text-gray-500 text-center mb-4">Get started by creating your first flyer job.</p>
      <Button onClick={() => navigate("/batches/flyers/jobs/new")}>
        <Plus className="mr-2 h-4 w-4" />
        Create New Job
      </Button>
    </div>
  );
};
