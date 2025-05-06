
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
    
    // Show a toast with helpful navigation suggestion
    toast.error("Page not found. You might need to use the correct path format: /batches/[product]/jobs/new", {
      duration: 5000,
    });
    
    // Try to suggest a correct path based on common patterns
    if (location.pathname.includes('/covers/jobs/new')) {
      toast("Try navigating to /batches/covers/jobs/new instead", {
        action: {
          label: "Go There",
          onClick: () => navigate('/batches/covers/jobs/new')
        },
        duration: 8000
      });
    }
  }, [location.pathname, navigate]);

  const goBack = () => {
    navigate(-1);
  };

  const goHome = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="pt-6 pb-8 px-6">
          <div className="flex flex-col items-center text-center">
            <div className="bg-red-100 p-3 rounded-full mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Page Not Found</h1>
            <p className="text-gray-600 mb-6">
              The page you're looking for doesn't exist or has been moved.
            </p>
            <p className="text-sm text-gray-500 mb-6 px-4 py-2 bg-gray-100 rounded-md w-full overflow-x-auto">
              <code>{location.pathname}</code>
            </p>
            <div className="flex gap-4 flex-col sm:flex-row w-full">
              <Button 
                className="flex items-center gap-2"
                onClick={goBack}
                variant="outline"
              >
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>
              <Button 
                className="flex items-center gap-2"
                onClick={goHome}
              >
                <Home className="h-4 w-4" />
                Return Home
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
