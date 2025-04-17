
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface BatchesErrorAlertProps {
  error: string;
  onRetry: () => void;
}

export const BatchesErrorAlert = ({ error, onRetry }: BatchesErrorAlertProps) => {
  return (
    <Alert variant="destructive" className="mb-6">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error loading batches</AlertTitle>
      <AlertDescription>
        {error}
        <div className="mt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRetry}
          >
            Try Again
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};
