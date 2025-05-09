
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Edit, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

import FormLoadingSpinner from '@/components/business-cards/FormLoadingSpinner';
import JobStatusBadge from '@/components/JobStatusBadge';

interface BusinessCardJob {
  id: string;
  name: string;
  job_number: string;
  quantity: number;
  double_sided: boolean;
  lamination_type: string;
  paper_type: string;
  due_date: string;
  created_at: string;
  status: string;
  file_name: string;
  pdf_url: string;
  batch_id?: string | null; // Add this field to fix the type error
}

const BusinessCardJobDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<BusinessCardJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJob = async () => {
      if (!id) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const { data, error: fetchError } = await supabase
          .from('business_card_jobs')
          .select('*')
          .eq('id', id)
          .single();
          
        if (fetchError) throw fetchError;
        
        setJob(data);
      } catch (err) {
        console.error('Error fetching job details:', err);
        setError('Could not load job details. Please try again later.');
        toast.error('Failed to load job details');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchJob();
  }, [id]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  const handleEditClick = () => {
    navigate(`/batches/business-cards/jobs/${id}/edit`);
  };

  const handleViewPDF = () => {
    if (job?.pdf_url) {
      window.open(job.pdf_url, '_blank');
    } else {
      toast.error('No PDF available for this job');
    }
  };

  if (isLoading) {
    return <FormLoadingSpinner message="Loading job details..." />;
  }

  if (error || !job) {
    return (
      <div className="container mx-auto py-6 max-w-4xl">
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error || 'Job not found'}</p>
              </div>
              <div className="mt-4">
                <Button 
                  size="sm" 
                  onClick={() => navigate('/batches/business-cards/jobs')}
                  className="flex items-center"
                >
                  <ArrowLeft size={16} className="mr-2" />
                  Back to Jobs
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <Button 
            variant="outline" 
            onClick={() => navigate('/batches/business-cards/jobs')}
            className="mb-2 flex items-center gap-1"
          >
            <ArrowLeft size={16} />
            <span>Back to Jobs</span>
          </Button>
          <div className="flex items-center">
            <FileText className="h-6 w-6 mr-2 text-batchflow-primary" />
            <h1 className="text-2xl font-bold tracking-tight">{job.name || 'Unnamed Job'}</h1>
          </div>
          <p className="text-gray-500 mt-1">
            Job #{job.job_number} • Business Cards
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={handleViewPDF}
            className="flex items-center gap-1"
            disabled={!job.pdf_url}
          >
            <Eye size={16} className="mr-1" />
            View PDF
          </Button>
          <Button 
            onClick={handleEditClick}
            className="flex items-center gap-1"
          >
            <Edit size={16} className="mr-1" />
            Edit Job
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Job Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <div className="font-medium text-gray-500">Status</div>
                <div className="mt-1">
                  <JobStatusBadge status={job.status} />
                </div>
              </div>

              <div>
                <div className="font-medium text-gray-500">Quantity</div>
                <div className="mt-1">{job.quantity}</div>
              </div>

              <div>
                <div className="font-medium text-gray-500">Paper Type</div>
                <div className="mt-1">{job.paper_type}</div>
              </div>

              <div>
                <div className="font-medium text-gray-500">Lamination</div>
                <div className="mt-1">
                  {job.lamination_type === 'none' ? 'None' : 
                    job.lamination_type.charAt(0).toUpperCase() + job.lamination_type.slice(1)}
                </div>
              </div>

              <div>
                <div className="font-medium text-gray-500">Double Sided</div>
                <div className="mt-1">{job.double_sided ? 'Yes' : 'No'}</div>
              </div>

              <div>
                <div className="font-medium text-gray-500">Created At</div>
                <div className="mt-1">{formatDate(job.created_at)}</div>
              </div>

              <div>
                <div className="font-medium text-gray-500">Due Date</div>
                <div className="mt-1">{formatDate(job.due_date)}</div>
              </div>

              {job.batch_id && (
                <div>
                  <div className="font-medium text-gray-500">Batch</div>
                  <div className="mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {job.batch_id}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>File Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm">
              <div className="font-medium text-gray-500">Filename</div>
              <div className="mt-1 break-all">{job.file_name || 'No file name'}</div>
            </div>

            {job.pdf_url && (
              <Button 
                className="w-full mt-4"
                onClick={handleViewPDF}
              >
                <Eye size={16} className="mr-2" />
                Open PDF
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BusinessCardJobDetail;
