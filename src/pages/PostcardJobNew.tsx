
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PostcardJobForm } from "@/components/postcards/PostcardJobForm";
import { useStorageBuckets } from "@/hooks/useStorageBuckets";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

const PostcardJobNew = () => {
  const navigate = useNavigate();
  const { isInitializing, error } = useStorageBuckets();
  
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

      {isInitializing && (
        <div className="flex items-center space-x-2 mb-4 text-blue-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Initializing storage...</span>
        </div>
      )}
      
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <PostcardJobForm />
    </div>
  );
};

export default PostcardJobNew;
