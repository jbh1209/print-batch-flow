
import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PostcardJobHeaderProps {
  jobNumber: string;
  jobName: string;
  onDelete: () => void;
  jobId: string;
}

export const PostcardJobHeader = ({
  jobNumber,
  jobName,
  onDelete,
  jobId
}: PostcardJobHeaderProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex justify-between items-center mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{jobName}</h1>
        <p className="text-gray-500 mt-1">Job #{jobNumber}</p>
      </div>
      <div className="flex items-center gap-3">
        <Button 
          variant="outline" 
          className="flex items-center gap-1"
          onClick={() => navigate("/batches/postcards/jobs")}
        >
          <ArrowLeft size={16} />
          <span>Back to Jobs</span>
        </Button>
        <Button 
          variant="outline"
          onClick={() => navigate(`/batches/postcards/jobs/${jobId}/edit`)}
        >
          <Edit size={16} className="mr-1" />
          <span>Edit</span>
        </Button>
        <Button 
          variant="destructive"
          onClick={onDelete}
        >
          <Trash2 size={16} className="mr-1" />
          <span>Delete</span>
        </Button>
      </div>
    </div>
  );
};
