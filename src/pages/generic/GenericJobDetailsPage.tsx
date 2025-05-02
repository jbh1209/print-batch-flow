
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, FileText, AlertCircle, Calendar, Package } from "lucide-react";
import { ProductConfig, BaseJob } from "@/config/productTypes";
import { format } from "date-fns";
import { isExistingTable } from "@/utils/database/tableValidation";
import { toast } from "sonner";

interface GenericJobDetailsPageProps {
  config: ProductConfig;
}

const GenericJobDetailsPage: React.FC<GenericJobDetailsPageProps> = ({ config }) => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  console.log(`Rendering GenericJobDetailsPage for ${config.productType} with jobId:`, jobId);
  
  const { data: job, isLoading, error } = useQuery({
    queryKey: [`${config.productType.toLowerCase()}-job-${jobId}`],
    queryFn: async () => {
      if (!jobId) {
        console.error("No jobId provided");
        toast.error("No job ID provided");
        return null;
      }
      
      // Check if the table name exists in the database
      if (!isExistingTable(config.tableName)) {
        console.error(`Table ${config.tableName} does not exist in the database`);
        toast.error(`Database table for ${config.productType} does not exist`);
        throw new Error(`Table ${config.tableName} does not exist in the database`);
      }
      
      try {
        console.log(`Fetching job details for ${config.productType} jobId:`, jobId);
        
        // Using any as a workaround for the type error
        // This ensures we can query any table that might not be in the Supabase types yet
        const { data, error } = await supabase
          .from(config.tableName as any)
          .select('*')
          .eq('id', jobId)
          .maybeSingle();
          
        if (error) {
          console.error('Error fetching job details:', error);
          throw error;
        }
        
        // Ensure we have a valid job object before returning it
        if (!data) {
          console.error('No job data returned');
          throw new Error('No job data returned');
        }
        
        console.log(`Job data received for ${config.productType}:`, data);
        
        // Type assertion after we've verified it's an object with job data
        return data as BaseJob;
      } catch (err) {
        console.error('Error fetching job details:', err);
        throw err;
      }
    }
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">Loading Job Details...</h2>
            <p className="text-gray-500">Please wait while we fetch the job information</p>
          </div>
        </div>
        <div className="bg-white shadow rounded-lg p-8 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">Job Not Found</h2>
            <p className="text-gray-500">The requested job could not be found</p>
          </div>
          <Button 
            variant="outline"
            onClick={() => navigate(config.routes.jobsPath)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Jobs
          </Button>
        </div>
        
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error ? `Error loading job details: ${(error as Error).message}` : "Job not found"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM dd, yyyy");
    } catch {
      return dateString;
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">{job.name}</h2>
          <p className="text-gray-500">Job #{job.job_number}</p>
        </div>
        <Button 
          variant="outline"
          onClick={() => navigate(config.routes.jobsPath)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Jobs
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5" />
                Job Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Job Name</p>
                    <p className="text-lg font-medium">{job.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Job Number</p>
                    <p className="text-lg font-medium">{job.job_number}</p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Status</p>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                        ${job.status === 'queued' ? 'bg-blue-100 text-blue-800' : 
                          job.status === 'batched' ? 'bg-yellow-100 text-yellow-800' :
                          job.status === 'completed' ? 'bg-green-100 text-green-800' :
                          job.status === 'error' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'}`}>
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Due Date</p>
                    <div className="flex items-center mt-1">
                      <Calendar className="mr-2 h-4 w-4 text-gray-500" />
                      <p>{formatDate(job.due_date)}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Quantity</p>
                    <p className="text-lg font-medium">{job.quantity}</p>
                  </div>
                  {job.size && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Size</p>
                      <p className="text-lg font-medium">{job.size}</p>
                    </div>
                  )}
                  {job.paper_type && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Paper Type</p>
                      <p className="text-lg font-medium">{job.paper_type}</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                  {job.paper_weight && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Paper Weight</p>
                      <p className="text-lg font-medium">{job.paper_weight}</p>
                    </div>
                  )}
                  {job.lamination_type && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Lamination</p>
                      <p className="text-lg font-medium">
                        {job.lamination_type === 'none' ? 'None' : 
                          job.lamination_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                    </div>
                  )}
                  {job.sides && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Sides</p>
                      <p className="text-lg font-medium">
                        {job.sides === 'single' ? 'Single sided' : 'Double sided'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {job.pdf_url && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-100 p-4 rounded-md mb-4">
                  <div className="flex items-center">
                    <FileText className="h-6 w-6 mr-2 text-blue-600" />
                    <span className="text-sm font-medium">{job.file_name}</span>
                  </div>
                </div>
                
                <div className="text-center">
                  <Button
                    onClick={() => window.open(job.pdf_url, '_blank')}
                    className="flex items-center justify-center mx-auto"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    View PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="mr-2 h-5 w-5" />
                Batch Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              {job.batch_id ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Batch ID</p>
                    <p className="text-sm font-mono bg-gray-100 p-1 rounded">{job.batch_id}</p>
                  </div>
                  <div className="pt-2">
                    <Button 
                      className="w-full"
                      variant="outline"
                      onClick={() => navigate(`${config.routes.batchesPath}/${job.batch_id}`)}
                    >
                      View Batch Details
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-500 mb-3">This job is not part of any batch yet.</p>
                  {job.status === 'queued' && (
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => navigate(config.routes.jobsPath)}
                    >
                      Go to Jobs Page to Batch
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => job.pdf_url && window.open(job.pdf_url, '_blank')}
                  disabled={!job.pdf_url}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  View PDF
                </Button>
                
                <Button 
                  variant="destructive" 
                  className="w-full justify-start"
                >
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Cancel Job
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default GenericJobDetailsPage;
