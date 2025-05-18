
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Download, Pencil, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGenericJobs } from '@/hooks/generic/useGenericJobs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BaseJob } from '@/config/types/baseTypes';
import { ProductConfig } from '@/config/productTypes';

export interface GenericJobDetailsPageProps {
  config: ProductConfig;
  backUrl?: string;
  editUrlGenerator?: (id: string) => string;
}

const GenericJobDetailsPage: React.FC<GenericJobDetailsPageProps> = ({
  config,
  backUrl,
  editUrlGenerator,
}) => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<BaseJob | null>(null);
  
  // Use config from props
  const { 
    getJobById, 
    deleteJob, 
    isLoading, 
    error 
  } = useGenericJobs(config, jobId);

  // Set default backUrl if not provided
  const effectiveBackUrl = backUrl || config.routes.jobsPath;
  
  // Create default edit URL generator if not provided
  const effectiveEditUrlGenerator = editUrlGenerator || 
    ((id: string) => `${config.routes.editJobPath}/${id}`);

  useEffect(() => {
    const loadJob = async () => {
      if (jobId) {
        const jobData = await getJobById(jobId);
        setJob(jobData);
      }
    };
    
    loadJob();
  }, [jobId, getJobById]);

  const handleDelete = async () => {
    if (!jobId) return;
    
    const confirmed = window.confirm('Are you sure you want to delete this job?');
    if (!confirmed) return;
    
    const success = await deleteJob(jobId);
    if (success) {
      navigate(effectiveBackUrl);
    }
  };

  const handleDownload = () => {
    if (job?.pdf_url) {
      window.open(job.pdf_url, '_blank');
    }
  };

  const handleEdit = () => {
    if (jobId) {
      navigate(effectiveEditUrlGenerator(jobId));
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <Button variant="ghost" onClick={() => navigate(effectiveBackUrl)}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Jobs
          </Button>
        </div>
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse text-lg">Loading job details...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <Button variant="ghost" onClick={() => navigate(effectiveBackUrl)}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Jobs
          </Button>
        </div>
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <Button variant="ghost" onClick={() => navigate(effectiveBackUrl)}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Jobs
          </Button>
        </div>
        <Alert variant="destructive">
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>The requested job could not be found.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <Button variant="ghost" onClick={() => navigate(effectiveBackUrl)}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Jobs
        </Button>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleDownload} disabled={!job.pdf_url}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
          <Button variant="outline" onClick={handleEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-4">{job.name}</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">Job Details</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Job Number:</span>
                <span className="font-medium">{job.job_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status:</span>
                <span className="font-medium capitalize">{job.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Quantity:</span>
                <span className="font-medium">{job.quantity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Due Date:</span>
                <span className="font-medium">
                  {new Date(job.due_date).toLocaleDateString()}
                </span>
              </div>
              {job.batch_id && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Batch ID:</span>
                  <span className="font-medium">{job.batch_id}</span>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <h2 className="text-lg font-semibold mb-2">Additional Information</h2>
            <div className="space-y-2">
              {job.size && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Size:</span>
                  <span className="font-medium">{job.size}</span>
                </div>
              )}
              {job.paper_type && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Paper Type:</span>
                  <span className="font-medium">{job.paper_type}</span>
                </div>
              )}
              {job.paper_weight && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Paper Weight:</span>
                  <span className="font-medium">{job.paper_weight}</span>
                </div>
              )}
              {job.lamination_type && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Lamination:</span>
                  <span className="font-medium capitalize">{job.lamination_type}</span>
                </div>
              )}
              {job.sides && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Sides:</span>
                  <span className="font-medium capitalize">{job.sides}</span>
                </div>
              )}
              {job.stock_type && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Stock Type:</span>
                  <span className="font-medium">{job.stock_type}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {job.pdf_url && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-2">PDF Preview</h2>
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex justify-between items-center">
                <span className="truncate max-w-md">{job.file_name}</span>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
            </div>
          </div>
        )}
        
        <div className="mt-6 text-sm text-gray-500">
          <div>Created: {new Date(job.created_at).toLocaleString()}</div>
          {job.updated_at && (
            <div>Last Updated: {new Date(job.updated_at).toLocaleString()}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GenericJobDetailsPage;
