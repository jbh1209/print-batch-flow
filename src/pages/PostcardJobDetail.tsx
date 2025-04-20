
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { PostcardJob } from "@/components/batches/types/PostcardTypes";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { PostcardJobHeader } from "@/components/postcards/components/PostcardJobHeader";
import { JobDetailsCard } from "@/components/postcards/components/JobDetailsCard";
import { PrintSpecsCard } from "@/components/postcards/components/PrintSpecsCard";
import { TimelineCard } from "@/components/postcards/components/TimelineCard";

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
      <Alert variant="destructive">
        <AlertDescription>{error || "Job not found"}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div>
      <PostcardJobHeader 
        jobNumber={job.job_number}
        jobName={job.name}
        onDelete={handleDeleteJob}
        jobId={job.id}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <JobDetailsCard 
          name={job.name}
          jobNumber={job.job_number}
          createdAt={job.created_at}
          status={job.status}
        />

        <PrintSpecsCard 
          size={job.size}
          paperType={job.paper_type}
          laminationType={job.lamination_type}
          quantity={job.quantity}
        />

        <TimelineCard 
          dueDate={job.due_date}
          batchId={job.batch_id}
          onViewPDF={handleViewPDF}
        />
      </div>
    </div>
  );
};

export default PostcardJobDetail;
