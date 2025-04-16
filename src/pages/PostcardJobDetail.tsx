
import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const PostcardJobDetail = () => {
  const navigate = useNavigate();
  const { jobId } = useParams();

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

      <div className="bg-white rounded-lg shadow p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">Job Details</h2>
        <p className="text-gray-500 mb-4">This feature will be implemented soon.</p>
        <Button onClick={() => navigate("/batches/postcards/jobs")}>Go Back</Button>
      </div>
    </div>
  );
};

export default PostcardJobDetail;
