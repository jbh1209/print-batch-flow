
import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";

const PostcardJobs = () => {
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Postcard Jobs</h1>
          <p className="text-gray-500 mt-1">Manage your postcard print jobs</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="flex items-center gap-1"
            onClick={() => navigate("/batches/postcards")}
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </Button>
          <Button onClick={() => navigate("/batches/postcards/jobs/new")}>
            <Plus size={16} className="mr-1" />
            Add New Job
          </Button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-lg shadow text-center">
        <h3 className="text-xl font-medium text-gray-700">Postcard Jobs</h3>
        <p className="text-gray-500 mt-2">Functionality has been reset</p>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={() => navigate("/batches/postcards/jobs/new")}
        >
          Create a New Job
        </Button>
      </div>
    </div>
  );
};

export default PostcardJobs;
