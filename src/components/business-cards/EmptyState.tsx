
import React from "react";
import { Button } from "@/components/ui/button";
import { FileText, AlertCircle, Loader2, Search, ArrowRight, Info } from "lucide-react";
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
    
    // Extract product type from the current path
    const pathParts = location.pathname.split('/');
    let productType = '';
    
    // Find "batches" in the path and get the next segment
    const batchesIndex = pathParts.indexOf('batches');
    if (batchesIndex >= 0 && batchesIndex + 1 < pathParts.length) {
      productType = pathParts[batchesIndex + 1];
      
      // Handle the jobs vs batches case
      if (entityName.toLowerCase() === 'jobs') {
        return `/batches/${productType}/jobs/new`;
      } else if (entityName.toLowerCase() === 'batches') {
        return `/batches/${productType}/jobs`;
      }
    }
    
    // If we're on a root product page
    if (location.pathname.endsWith(`/${productType}`)) {
      return `/batches/${productType}/jobs`;
    }
    
    // Default paths for common product types
    if (productType) {
      if (entityName.toLowerCase() === 'jobs') {
        return `/batches/${productType}/jobs/new`;
      } else {
        return `/batches/${productType}/jobs`;
      }
    }
    
    // Fallback to dashboard
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
        buttonText: `Create New ${entityName.slice(0, -1)}` // Remove plural 's'
      };
    } else if (entityName.toLowerCase() === 'batches') {
      return {
        title: `No ${entityName} found`,
        description: `To create batches, you'll need to create and select jobs first`,
        buttonText: `View Jobs`
      };
    }
    
    return {
      title: `No ${entityName} found`,
      description: `Get started by creating your first ${entityName.toLowerCase()}`,
      buttonText: `Create ${entityName}`
    };
  };
  
  const entityText = getEntityText();
  
  // Extract product name for better messaging
  const getProductName = () => {
    const path = location.pathname;
    if (path.includes('/business-cards')) return 'Business Card';
    if (path.includes('/flyers')) return 'Flyer';
    if (path.includes('/postcards')) return 'Postcard';
    if (path.includes('/sleeves')) return 'Sleeve';
    if (path.includes('/boxes')) return 'Box';
    if (path.includes('/stickers')) return 'Sticker';
    if (path.includes('/covers')) return 'Cover';
    if (path.includes('/posters')) return 'Poster';
    return '';
  };
  
  const productName = getProductName();
  
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-500">
      <div className="bg-gray-100 p-4 rounded-full mb-4">
        <FileText className="h-10 w-10 text-gray-400" />
      </div>
      <h3 className="font-medium text-lg mb-1">{entityText.title}</h3>
      <p className="text-sm text-gray-400 mb-4">{entityText.description}</p>
      
      <div className="flex flex-col sm:flex-row gap-3">
        <Button asChild>
          <Link to={createButtonPath}>
            {productName ? `${entityText.buttonText} ${productName}` : entityText.buttonText}
          </Link>
        </Button>
        
        {entityName.toLowerCase() === 'jobs' && (
          <Button variant="outline" asChild>
            <Link to={createButtonPath.replace('/jobs/new', '')}>
              View {productName} Overview
            </Link>
          </Button>
        )}
      </div>
      
      {/* Help section */}
      <div className="mt-6 bg-blue-50 border border-blue-100 text-blue-800 p-4 rounded-md text-sm max-w-md">
        <div className="flex items-start">
          <Info className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium mb-2">Navigation Help:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Use the sidebar to navigate between products</li>
              <li>Create jobs first, then batch them for printing</li>
              <li>Each product has its own jobs and batches sections</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Debug info to help users understand paths */}
      <div className="mt-4 flex items-center text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-full">
        <Search className="h-3 w-3 mr-1" />
        <span>Path: {createButtonPath}</span>
        <ArrowRight className="h-3 w-3 mx-1" />
        <span className="font-mono">{entityName.toLowerCase() === 'jobs' ? 'Create' : 'View'}</span>
      </div>
    </div>
  );
};

export default EmptyState;
