
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import JobsHeader from "@/components/business-cards/JobsHeader";
import { useProductTypes } from "@/hooks/admin/useProductTypes";

const Postcards = () => {
  const navigate = useNavigate();
  const { productTypes, isLoading, error } = useProductTypes();
  
  // Check if postcards product exists
  const postcardsProduct = !isLoading && productTypes.find(p => 
    p.slug === 'postcards' || p.name.toLowerCase() === 'postcards'
  );
  
  useEffect(() => {
    // If postcards product exists in the database, navigate to its generic page
    if (postcardsProduct) {
      navigate(`/batches/${postcardsProduct.slug}`);
    }
  }, [postcardsProduct, navigate]);

  return (
    <div className="container mx-auto p-6">
      <JobsHeader 
        title="Postcards Management" 
        subtitle="Create and manage postcard print jobs" 
      />

      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      ) : !postcardsProduct ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Set Up Postcards Product</CardTitle>
              <CardDescription>
                You need to set up the Postcards product type before you can manage postcard jobs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500 mb-4">
                Use the Product Manager to create a new product type for postcards. 
                This will enable all the functionality needed to manage postcard jobs and batches.
              </p>
            </CardContent>
            <CardFooter className="flex gap-4">
              <Button onClick={() => navigate("/admin/products/create")}>
                Create Postcards Product
              </Button>
              <Button variant="outline" onClick={() => navigate("/")}>
                Back to Dashboard
              </Button>
            </CardFooter>
          </Card>
          
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Getting Started</AlertTitle>
            <AlertDescription>
              When creating the Postcards product, make sure to provide all required fields and 
              configure options like paper types and sizes that are relevant for postcards.
            </AlertDescription>
          </Alert>
        </div>  
      ) : null}
    </div>
  );
};

export default Postcards;
