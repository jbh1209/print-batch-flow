
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ArrowLeft, FileText, Printer, ExternalLink, Pencil } from 'lucide-react';
import { ProductConfig, BaseJob } from '@/config/productTypes';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import JobStatusBadge from '@/components/JobStatusBadge';

interface GenericJobDetailsPageProps {
  config: ProductConfig;
}

const GenericJobDetailsPage: React.FC<GenericJobDetailsPageProps> = ({ config }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJobDetails = async () => {
      if (!id || !config.tableName) {
        setError('Invalid job ID or table name');
        setIsLoading(false);
        return;
      }

      try {
        console.log(`Fetching job ${id} from table ${config.tableName}`);
        const { data, error: fetchError } = await supabase
          .from(config.tableName)
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) {
          console.error('Error fetching job:', fetchError);
          setError('Failed to load job details');
          setIsLoading(false);
          return;
        }

        console.log('Job data:', data);
        setJob(data);
      } catch (err) {
        console.error('Exception fetching job details:', err);
        setError('An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobDetails();
  }, [id, config.tableName]);

  const handleBack = () => {
    navigate(config.routes.jobsPath);
  };

  const handleEdit = () => {
    if (id && config.routes.jobEditPath) {
      navigate(config.routes.jobEditPath(id));
    }
  };

  const handleViewPdf = () => {
    if (job?.pdf_url) {
      window.open(job.pdf_url, '_blank');
    } else {
      toast.error('No PDF available for this job');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Loading job details...</span>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-red-800 font-medium">Job not found</h3>
              <p className="text-red-700 mt-1 text-sm">{error || 'The requested job could not be found or has been deleted.'}</p>
              <Button variant="outline" size="sm" onClick={handleBack} className="mt-3">
                Back to Jobs
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Button
            variant="outline"
            size="icon"
            onClick={handleBack}
            className="mr-3"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{job.name}</h1>
            <p className="text-gray-500">
              Job #{job.job_number} • {config.productType}
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          {job.status === 'queued' && (
            <Button variant="outline" onClick={handleEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Job
            </Button>
          )}
          {job.pdf_url && (
            <Button onClick={handleViewPdf}>
              <FileText className="h-4 w-4 mr-2" />
              View PDF
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Job Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <div className="border-b pb-2 sm:border-b-0">
                <dt className="text-sm text-gray-500">Status</dt>
                <dd><JobStatusBadge status={job.status} /></dd>
              </div>
              
              <div className="border-b pb-2 sm:border-b-0">
                <dt className="text-sm text-gray-500">Quantity</dt>
                <dd className="font-medium">{job.quantity}</dd>
              </div>
              
              {job.size && (
                <div className="border-b pb-2 sm:border-b-0">
                  <dt className="text-sm text-gray-500">Size</dt>
                  <dd className="font-medium">{job.size}</dd>
                </div>
              )}
              
              {job.paper_type && (
                <div className="border-b pb-2 sm:border-b-0">
                  <dt className="text-sm text-gray-500">Paper Type</dt>
                  <dd className="font-medium">{job.paper_type}</dd>
                </div>
              )}
              
              {job.paper_weight && (
                <div className="border-b pb-2 sm:border-b-0">
                  <dt className="text-sm text-gray-500">Paper Weight</dt>
                  <dd className="font-medium">{job.paper_weight}</dd>
                </div>
              )}
              
              {job.lamination_type && (
                <div className="border-b pb-2 sm:border-b-0">
                  <dt className="text-sm text-gray-500">Lamination</dt>
                  <dd className="font-medium">
                    {job.lamination_type === 'none' ? 'None' : job.lamination_type}
                  </dd>
                </div>
              )}
              
              {job.sides && (
                <div className="border-b pb-2 sm:border-b-0">
                  <dt className="text-sm text-gray-500">Sides</dt>
                  <dd className="font-medium">
                    {job.sides === 'single' ? 'Single-sided' : 'Double-sided'}
                  </dd>
                </div>
              )}
              
              <div className="border-b pb-2 sm:border-b-0">
                <dt className="text-sm text-gray-500">Due Date</dt>
                <dd className="font-medium">
                  {job.due_date ? format(new Date(job.due_date), 'dd MMM yyyy') : 'Not set'}
                </dd>
              </div>
              
              <div className="border-b pb-2 sm:border-b-0">
                <dt className="text-sm text-gray-500">Created</dt>
                <dd className="font-medium">
                  {job.created_at ? format(new Date(job.created_at), 'dd MMM yyyy') : 'Unknown'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">File Details</CardTitle>
          </CardHeader>
          <CardContent>
            {job.file_name ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Filename</p>
                  <p className="text-sm font-medium truncate">{job.file_name}</p>
                </div>
                
                {job.pdf_url && (
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={handleViewPdf}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open PDF
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No file attached</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GenericJobDetailsPage;
