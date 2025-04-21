
import React from "react";
import { Button } from "@/components/ui/button";
import { FileText, AlertCircle, Loader2 } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

interface EmptyStateProps {
  type: "loading" | "error" | "empty";
  entityName: string;
  createPath?: string;
  errorMessage?: string;
  onRetry?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ 
  type,
  entityName,
  createPath,
  errorMessage,
  onRetry
}) => {
  // Get current location to determine the correct create path
  const location = useLocation();
  
  // Determine the appropriate create path based on the current route
  const getCreatePath = () => {
    if (createPath) return createPath;
    
    if (location.pathname.includes('/postcards')) {
      // If we're on the postcard batches page, direct to jobs page for batching
      if (location.pathname.endsWith('/batches')) {
        return "/batches/postcards/jobs";
      }
      return "/batches/postcards/jobs/new";
    } else if (location.pathname.includes('/business-cards')) {
      return "/batches/business-cards/jobs/new";
    } else if (location.pathname.includes('/flyers')) {
      return "/batches/flyers/jobs/new";
    }
    
    return "/";
  };
  
  if (type === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <Loader2 className="h-12 w-12 animate-spin text-gray-300 mb-4" />
        <h3 className="font-medium text-lg mb-1">Loading {entityName}...</h3>
        <p className="text-sm text-gray-400">Please wait while we fetch your data</p>
      </div>
    );
  }
  
  if (type === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <div className="bg-red-100 p-4 rounded-full mb-4">
          <AlertCircle className="h-10 w-10 text-red-500" />
        </div>
        <h3 className="font-medium text-lg text-red-600 mb-1">Couldn't load {entityName}</h3>
        <p className="text-sm text-gray-500 mb-4 max-w-md text-center">
          {errorMessage || `There was a problem loading the ${entityName}. Please try again later.`}
        </p>
        {onRetry && (
          <Button onClick={onRetry}>Try Again</Button>
        )}
      </div>
    );
  }
  
  // Default empty state
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
      <div className="bg-gray-100 p-4 rounded-full mb-4">
        <FileText className="h-10 w-10 text-gray-400" />
      </div>
      <h3 className="font-medium text-lg mb-1">No {entityName} found</h3>
      <p className="text-sm text-gray-400 mb-4">Get started by creating your first {entityName.toLowerCase()}</p>
      
      <Button asChild>
        <Link to={getCreatePath()}>Create {entityName}</Link>
      </Button>
    </div>
  );
};

export default EmptyState;
