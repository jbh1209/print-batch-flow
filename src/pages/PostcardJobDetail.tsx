import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Trash2, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { PostcardJob } from "@/components/batches/types/PostcardTypes";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { laminationLabels } from "@/components/postcards/schema/postcardJobFormSchema";

const PostcardJobDetail = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState<PostcardJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJob = async () => {
      if (!jobId || !user) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        const { data, error: fetchError } = await supabase
          .from('postcard_jobs')
          .select('*')
          .eq('id', jobId)
          .eq('user_id', user.id)
          .single();
        
        if (fetchError) throw fetchError;
        
        setJob(data as PostcardJob);
      } catch (err) {
        console.error('Error fetching job:', err);
        setError('Failed to load job details');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchJob();
  }, [jobId, user]);
  
  const handleDeleteJob = async () => {
    if (!jobId) return;
    
    try {
      const { error } = await supabase
        .from('postcard_jobs')
        .delete()
        .eq('id', jobId);
      
      if (error) throw error;
      
      toast.success('Job deleted successfully');
      navigate('/batches/postcards/jobs');
    } catch (error) {
      console.error('Error deleting job:', error);
      toast.error('Failed to delete job');
    }
  };
  
  const handleViewPDF = () => {
    if (job?.pdf_url) {
      window.open(job.pdf_url, '_blank');
    } else {
      toast.error('PDF not available');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <Button 
            variant="outline" 
            className="flex items-center gap-1"
            onClick={() => navigate("/batches/postcards/jobs")}
          >
            <ArrowLeft size={16} />
            <span>Back to Jobs</span>
          </Button>
        </div>
        
        <Alert variant="destructive">
          <AlertDescription>{error || "Job not found"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{job.name}</h1>
          <p className="text-gray-500 mt-1">Job #{job.job_number}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="flex items-center gap-1"
            onClick={() => navigate("/batches/postcards/jobs")}
          >
            <ArrowLeft size={16} />
            <span>Back to Jobs</span>
          </Button>
          <Button 
            variant="outline"
            onClick={() => navigate(`/batches/postcards/jobs/${jobId}/edit`)}
          >
            <Edit size={16} className="mr-1" />
            <span>Edit</span>
          </Button>
          <Button 
            variant="destructive"
            onClick={handleDeleteJob}
          >
            <Trash2 size={16} className="mr-1" />
            <span>Delete</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Job Details</CardTitle>
            <CardDescription>Basic information about this job</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-500">Client:</span>
                <span>{job.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-500">Job Number:</span>
                <span>{job.job_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-500">Created:</span>
                <span>{format(new Date(job.created_at), 'PPP')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-500">Status:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium 
                  ${job.status === 'queued' ? 'bg-yellow-100 text-yellow-800' : 
                  job.status === 'batched' ? 'bg-blue-100 text-blue-800' : 
                  job.status === 'completed' ? 'bg-green-100 text-green-800' : 
                  'bg-gray-100 text-gray-800'}`}
                >
                  {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Print Specifications</CardTitle>
            <CardDescription>Technical details for printing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-500">Size:</span>
                <span>{job.size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-500">Paper Type:</span>
                <span>{job.paper_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-500">Lamination:</span>
                <span>{laminationLabels[job.lamination_type]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-500">Sides:</span>
                <span>{job.double_sided ? 'Double-sided' : 'Single-sided'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-500">Quantity:</span>
                <span>{job.quantity}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
            <CardDescription>Due date and scheduling</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-500">Due Date:</span>
                <span>{format(new Date(job.due_date), 'PPP')}</span>
              </div>
              {job.batch_id && (
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-500">Batch ID:</span>
                  <span className="font-mono text-xs">{job.batch_id}</span>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button 
              variant="outline" 
              className="flex items-center gap-1"
              onClick={handleViewPDF}
            >
              <FileText size={16} />
              <span>View PDF</span>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default PostcardJobDetail;
