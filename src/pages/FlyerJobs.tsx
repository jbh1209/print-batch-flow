
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, Plus } from "lucide-react";
import { FlyerJobsTable } from "@/components/flyers/FlyerJobsTable";

const FlyerJobs = () => {
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center">
            <FileText className="h-6 w-6 mr-2 text-printstream-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Flyer Jobs</h1>
          </div>
          <p className="text-gray-500 mt-1">Manage print jobs for flyers</p>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={() => navigate("/batches/flyers")}
          >
            Back to Flyers
          </Button>
          <Button
            onClick={() => navigate("/batches/flyers/jobs/new")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create New Job
          </Button>
        </div>
      </div>
      
      <div className="mt-4">
        <FlyerJobsTable />
      </div>
    </div>
  );
};

export default FlyerJobs;
