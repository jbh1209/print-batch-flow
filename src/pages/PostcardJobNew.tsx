
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { PostcardJobForm } from "@/components/postcards/PostcardJobForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";

const PostcardJobNew = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  
  // Handle authentication state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }
  
  // Handle not authenticated state
  if (!user) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You need to be logged in to create postcard jobs
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate("/auth")}>Log in</Button>
      </div>
    );
  }
  
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
