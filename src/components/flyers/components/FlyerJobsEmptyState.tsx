
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export const FlyerJobsEmptyState = () => {
  const navigate = useNavigate();
  
  const handleCreateClick = () => {
    toast.info("Creating a new flyer job");
    navigate("/batches/flyers/jobs/new");
  };
  
  return (
    <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg border border-dashed border-gray-300 p-8">
      <FileText className="h-12 w-12 text-gray-400 mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-1">No flyer jobs found</h3>
      <p className="text-gray-500 text-center mb-4">Get started by creating your first flyer job.</p>
      
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={handleCreateClick} className="flex items-center">
          <Plus className="mr-2 h-4 w-4" />
          Create New Job
        </Button>
        
        <Button variant="outline" asChild>
          <Link to="/batches/flyers" className="flex items-center">
            View Flyer Batches
          </Link>
        </Button>
      </div>
      
      <div className="mt-6 bg-blue-50 text-blue-800 p-3 rounded-md text-sm max-w-md">
        <p className="font-medium mb-1">Quick Help:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Create new jobs using the button above</li>
          <li>Jobs can be batched for printing later</li>
          <li>View batches to see completed print jobs</li>
        </ul>
      </div>
    </div>
  );
};
