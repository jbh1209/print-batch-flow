
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface BatchDetailsHeaderProps {
  backUrl: string;
  error?: string | null;
}

const BatchDetailsHeader = ({ backUrl, error }: BatchDetailsHeaderProps) => {
  const navigate = useNavigate();
  
  const handleBackClick = () => {
    try {
      navigate(backUrl);
    } catch (error) {
      console.error('Navigation error:', error);
      navigate(backUrl);
    }
  };
  
  return (
    <div className="mb-6">
      <div className="flex items-center mb-4">
        <Button 
          variant="outline" 
          size="sm" 
          className="mr-4"
          onClick={handleBackClick}
        >
          <ArrowLeft size={16} className="mr-1" /> Back to Batches
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading batch</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleBackClick}
              >
                Back to Batches
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default BatchDetailsHeader;
