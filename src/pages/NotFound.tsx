import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home, ArrowLeft, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { productConfigs } from "@/config/productTypes";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [suggestedPath, setSuggestedPath] = useState<string | null>(null);

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
    
    // Parse the current path to find potentially wrong patterns
    const path = location.pathname;
    let suggestion: string | null = null;
    
    // Check for users accessing jobs directly without the proper batches prefix
    if (path.includes('/jobs') && !path.includes('/batches/')) {
      // Missing /batches/ prefix in product path
      const productType = path.split('/')[1];
      suggestion = `/batches/${productType}/jobs`;
      
      // If it's a specific job ID, keep that in the suggested path
      const pathParts = path.split('/');
      if (pathParts.length >= 3 && pathParts[2] === 'jobs' && pathParts[3]) {
        suggestion = `/batches/${productType}/jobs/${pathParts[3]}`;
      }
    } 
    // Check for common pattern mistakes
    else if (path.includes('/jobs/new') && !path.includes('/batches/')) {
      // Missing /batches/ prefix in product path
      const productType = path.split('/')[1];
      suggestion = `/batches/${productType}/jobs/new`;
    } 
    else if (path.includes('/covers/jobs/new')) {
      suggestion = '/batches/covers/jobs/new';
    }
    else if (path.includes('/flyers/jobs/new')) {
      suggestion = '/batches/flyers/jobs/new';
    }
    else if (path.includes('/postcards/jobs/new')) {
      suggestion = '/batches/postcards/jobs/new';
    }
    else if (path.includes('/posters/jobs/new')) {
      suggestion = '/batches/posters/jobs/new';
    }
    else if (path.includes('/business-cards/jobs/new')) {
      suggestion = '/batches/business-cards/jobs/new';
    }
    else if (path.includes('/stickers/jobs/new')) {
      suggestion = '/batches/stickers/jobs/new';
    }
    else if (path.includes('/sleeves/jobs/new')) {
      suggestion = '/batches/sleeves/jobs/new';
    }
    else if (path.includes('/boxes/jobs/new')) {
      suggestion = '/batches/boxes/jobs/new';
    }
    // Check for direct access to jobs page without batches prefix
    else if (path.endsWith('/jobs')) {
      const productType = path.split('/')[1];
      suggestion = `/batches/${productType}/jobs`;
    }
    
    // Check for batch path errors
    if (path.includes('/batches/') && !path.includes('/jobs/') && !path.includes('/batches/')) {
      // Possible missing 'batches' in the path - common error when trying to view batch details
      const segments = path.split('/');
      if (segments.length >= 3) {
        const productType = segments[2];
        const batchId = segments[3];
        if (batchId && batchId.length > 10) { // Looks like an ID
          suggestion = `/batches/${productType}/batches/${batchId}`;
        }
      }
    }
    
    // Find all available product routes for suggestions
    const availableRoutes = Object.values(productConfigs).map(config => ({
      name: config.productType,
      jobsPath: config.routes.jobsPath,
      newJobPath: config.routes.newJobPath,
      batchesPath: config.routes.batchesPath
    }));
    
    // Check for misspelled product types
    if (path.startsWith('/batches/') && segments.length >= 3) {
      const enteredProduct = segments[2];
      // Check if it's a slight misspelling of a valid product
      const products = Object.values(productConfigs).map(c => c.productType.toLowerCase());
      const closestMatch = products.find(p => 
        p.includes(enteredProduct.toLowerCase()) || 
        enteredProduct.toLowerCase().includes(p)
      );
      
      if (closestMatch) {
        const formattedProduct = closestMatch.replace(/\s+/g, '-').toLowerCase();
        // Reconstruct the path with the correct product name
        const remainingPath = segments.slice(3).join('/');
        suggestion = `/batches/${formattedProduct}/${remainingPath}`;
      }
    }
    
    // If we've determined a suggestion, offer it to the user
    if (suggestion) {
      setSuggestedPath(suggestion);
      toast("We found a possible correct path", {
        action: {
          label: "Go There",
          onClick: () => navigate(suggestion)
        },
        duration: 10000
      });
    } else {
      // Show a generic error toast
      toast.error("Page not found. You might need to use the correct path format: /batches/[product]/jobs", {
        duration: 5000,
      });
    }
  }, [location.pathname, navigate]);

  const goBack = () => {
    navigate(-1);
  };

  const goHome = () => {
    navigate("/");
  };

  const goToSuggested = () => {
    if (suggestedPath) {
      navigate(suggestedPath);
    }
  };

  const segments = location.pathname.split('/');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="pt-6 pb-8 px-6">
          <div className="flex flex-col items-center text-center">
            <div className="bg-red-100 p-3 rounded-full mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Page Not Found</h1>
            <p className="text-gray-600 mb-4">
              The page you're looking for doesn't exist or has been moved.
            </p>
            
            <div className="text-sm text-gray-500 mb-6 px-4 py-2 bg-gray-100 rounded-md w-full overflow-x-auto">
              <code>{location.pathname}</code>
            </div>
            
            {suggestedPath && (
              <div className="mb-6 w-full">
                <p className="text-sm font-medium text-green-600 mb-2">Did you mean to go here instead?</p>
                <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
                  <Search className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <code className="text-xs text-green-700 overflow-x-auto">{suggestedPath}</code>
                </div>
                <Button 
                  className="w-full mt-2"
                  variant="outline"
                  onClick={goToSuggested}
                >
                  Go to Suggested Path
                </Button>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-3 w-full">
              <Button 
                className="flex items-center justify-center gap-2"
                onClick={goBack}
                variant="outline"
              >
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>
              <Button 
                className="flex items-center justify-center gap-2"
                onClick={goHome}
              >
                <Home className="h-4 w-4" />
                Home
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
