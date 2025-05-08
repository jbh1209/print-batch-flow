
import React from "react";
import { Button } from "@/components/ui/button";
import { FileText, AlertCircle, Loader2, Search } from "lucide-react";
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
    
    // Use standard pattern for entity creation paths
    const currentPath = location.pathname;
    console.log("EmptyState currentPath:", currentPath);
    
    // Extract product type from path: /batches/[product]/...
    const pathParts = currentPath.split('/');
    let productType = '';
    
    if (pathParts.length >= 3 && pathParts[1] === 'batches') {
      productType = pathParts[2];
      
      // Handle various entity types
      if (entityName.toLowerCase() === 'jobs') {
        return `/batches/${productType}/jobs/new`;
      } else if (entityName.toLowerCase() === 'batches') {
        return `/batches/${productType}/jobs`;
      }
    }
    
    // Check if we're on a jobs page but not seeing any jobs
    if (currentPath.includes('/jobs') && !currentPath.includes('/new')) {
      // We're on a jobs page but no jobs are found, direct to create new job
      const productTypePath = currentPath.split('/jobs')[0];
      return `${productTypePath}/jobs/new`;
    }
    
    // Standard mappings for common paths
    if (location.pathname.includes('/postcards')) {
      // If we're on the postcard batches page, direct to jobs selection for batching
      if (location.pathname.endsWith('/batches')) {
        return "/batches/postcards/jobs";
      }
      return "/batches/postcards/jobs/new";
    } else if (location.pathname.includes('/business-cards')) {
      // If we're on the business cards jobs page, direct to new job creation
      if (location.pathname.endsWith('/jobs')) {
        return "/batches/business-cards/jobs/new";
      }
      return "/batches/business-cards/jobs/new";
    } else if (location.pathname.includes('/flyers')) {
      // If we're on the flyers jobs page, direct to new job creation
      if (location.pathname.endsWith('/jobs')) {
        return "/batches/flyers/jobs/new";
      }
      return "/batches/flyers/jobs/new";
    } else if (location.pathname.includes('/covers')) {
      return "/batches/covers/jobs/new";
    } else if (location.pathname.includes('/posters')) {
      return "/batches/posters/jobs/new";
    } else if (location.pathname.includes('/sleeves')) {
      return "/batches/sleeves/jobs/new";
    } else if (location.pathname.includes('/stickers')) {
      return "/batches/stickers/jobs/new";
    } else if (location.pathname.includes('/boxes')) {
      return "/batches/boxes/jobs/new";
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
  const createButtonPath = getCreatePath();
  
  const getEntityText = () => {
    if (entityName.toLowerCase() === 'jobs') {
      return {
        title: `No ${entityName} found`,
        description: `Get started by creating your first ${entityName.toLowerCase()}`,
        buttonText: `Create New ${entityName}`
      };
    } else if (entityName.toLowerCase() === 'batches') {
      return {
        title: `No ${entityName} found`,
        description: `To create batches, you'll need to create and select jobs first`,
        buttonText: location.pathname.includes('/postcards') ? "Select Jobs to Batch" : `Create Jobs for Batching`
      };
    }
    
    return {
      title: `No ${entityName} found`,
      description: `Get started by creating your first ${entityName.toLowerCase()}`,
      buttonText: `Create ${entityName}`
    };
  };
  
  const entityText = getEntityText();
  
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
      <div className="bg-gray-100 p-4 rounded-full mb-4">
        <FileText className="h-10 w-10 text-gray-400" />
      </div>
      <h3 className="font-medium text-lg mb-1">{entityText.title}</h3>
      <p className="text-sm text-gray-400 mb-4">{entityText.description}</p>
      
      <Button asChild>
        <Link to={createButtonPath}>
          {entityText.buttonText}
        </Link>
      </Button>
      
      {/* Display path for clarity */}
      <div className="mt-4 flex items-center text-xs text-gray-400">
        <Search className="h-3 w-3 mr-1" />
        <span>Path: {createButtonPath}</span>
      </div>
    </div>
  );
};

export default EmptyState;
