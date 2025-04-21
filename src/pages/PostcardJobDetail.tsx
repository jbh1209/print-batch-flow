
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const PostcardJobDetail = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Postcard Job Details</h1>
          <p className="text-gray-500 mt-1">Job ID: {jobId}</p>
        </div>
        <Button 
          variant="outline" 
          className="flex items-center gap-1"
          onClick={() => navigate("/batches/postcards/jobs")}
        >
          <ArrowLeft size={16} />
          <span>Back to Jobs</span>
        </Button>
      </div>

      <div className="bg-white p-8 rounded-lg shadow text-center">
        <Alert>
          <AlertDescription>
            Postcard job detail functionality has been reset
          </AlertDescription>
        </Alert>
        <Button 
          className="mt-4"
          onClick={() => navigate("/batches/postcards/jobs")}
        >
          Return to Jobs List
        </Button>
      </div>
    </div>
  );
};

export default PostcardJobDetail;
