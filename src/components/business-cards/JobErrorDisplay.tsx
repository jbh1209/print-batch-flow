
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface JobErrorDisplayProps {
  error: string;
  backPath?: string;
}

const JobErrorDisplay = ({ error, backPath = "/batches/business-cards/jobs" }: JobErrorDisplayProps) => {
  const navigate = useNavigate();
  
  return (
    <div>
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
      <div className="flex justify-center">
        <button 
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded"
          onClick={() => navigate(backPath)}
        >
          Back to Jobs
        </button>
      </div>
    </div>
  );
};

export default JobErrorDisplay;
