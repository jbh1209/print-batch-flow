
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import JobsHeader from "@/components/business-cards/JobsHeader";

const PostcardBatches = () => {
  const navigate = useNavigate();
  
  return (
    <div>
      <JobsHeader 
        title="Postcard Batches" 
        subtitle="View and manage all your postcard batches" 
      />

      <div className="flex justify-end mb-4">
        <Button 
          variant="outline" 
          className="flex items-center gap-1"
          onClick={() => navigate("/batches/postcards")}
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </Button>
      </div>

      <div className="bg-white p-8 rounded-lg shadow text-center">
        <h3 className="text-xl font-medium text-gray-700">Postcard Batches</h3>
        <p className="text-gray-500 mt-2">Functionality has been reset</p>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={() => navigate("/batches/postcards/jobs")}
        >
          View Jobs
        </Button>
      </div>
    </div>
  );
};

export default PostcardBatches;
