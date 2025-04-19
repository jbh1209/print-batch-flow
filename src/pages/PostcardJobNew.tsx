
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PostcardJobForm } from "@/components/postcards/PostcardJobForm";

const PostcardJobNew = () => {
  const navigate = useNavigate();
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Postcard Job</h1>
          <p className="text-gray-500 mt-1">Create a new postcard printing job</p>
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

      <PostcardJobForm />
    </div>
  );
};

export default PostcardJobNew;
