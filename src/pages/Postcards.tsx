
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { AlertCircle, FileText, ArrowLeft, Plus } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import JobsHeader from "@/components/business-cards/JobsHeader";
import { useProductTypes } from "@/hooks/admin/useProductTypes";
import { toast } from "sonner";

const Postcards = () => {
  const navigate = useNavigate();
  const { productTypes, isLoading, error } = useProductTypes();
  const [tabView, setTabView] = useState<'overview' | 'jobs' | 'batches'>('overview');
  
  // Check if postcards product exists
  const postcardsProduct = !isLoading && productTypes.find(p => 
    p.slug === 'postcards' || p.name.toLowerCase() === 'postcards'
  );
  
  useEffect(() => {
    // Only redirect if finding an exact match on product type and slug
    if (postcardsProduct && postcardsProduct.slug === 'postcards') {
      toast.info(`Navigating to ${postcardsProduct.name} product page`);
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
          
          {/* Sample configuration for postcards */}
          <Card>
            <CardHeader>
              <CardTitle>Recommended Configuration</CardTitle>
              <CardDescription>Sample settings for postcards product</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-2">Basic Settings</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Product Name: <span className="font-mono">Postcards</span></li>
                    <li>Product Slug: <span className="font-mono">postcards</span></li>
                    <li>Table Name: <span className="font-mono">postcard_jobs</span></li>
                    <li>Job Number Prefix: <span className="font-mono">PC</span></li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Fields to Add</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Paper Types: Matt, Gloss, Uncoated</li>
                    <li>Sizes: A6, A5, DL</li>
                    <li>Lamination Options: None, Gloss, Matt</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>  
      ) : (
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Postcard Jobs</CardTitle>
                <CardDescription>Manage individual postcard print jobs</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-4">Access all postcard jobs with detailed status tracking</p>
              </CardContent>
              <CardFooter>
                <Button className="w-full" onClick={() => navigate(`/batches/${postcardsProduct.slug}/jobs`)}>
                  View Jobs
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Postcard Batches</CardTitle>
                <CardDescription>Manage batched postcard production runs</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-4">View and manage postcard printing batches</p>
              </CardContent>
              <CardFooter>
                <Button className="w-full" onClick={() => navigate(`/batches/${postcardsProduct.slug}`)}>
                  View Batches
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Create New Job</CardTitle>
                <CardDescription>Add a new postcard print job</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-4">Submit a new postcard job with detailed specifications</p>
              </CardContent>
              <CardFooter>
                <Button className="w-full" onClick={() => navigate(`/batches/${postcardsProduct.slug}/jobs/new`)}>
                  Create Job
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default Postcards;
