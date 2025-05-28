
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FlyerJobForm } from "@/components/flyers/FlyerJobForm";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface PostcardJob {
  id: string;
  name: string;
  job_number: string;
  size: string;
  paper_weight: string;
  paper_type: string;
  quantity: number;
  due_date: string;
  batch_id: string | null;
  status: string;
  pdf_url: string;
  file_name: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

const PostcardJobEdit = () => {
  const { jobId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState<PostcardJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchJob = async () => {
      if (!user || !jobId) return;

      try {
        const { data, error } = await supabase
          .from('postcard_jobs')
          .select('*')
          .eq('id', jobId)
          .single();

        if (error) throw error;
        
        console.log('Fetched postcard job data:', data);
        setJob(data as PostcardJob);
      } catch (err) {
        console.error('Error fetching job:', err);
        toast.error('Failed to load job');
        navigate('/batches/postcards/jobs');
      } finally {
        setIsLoading(false);
      }
    };

    fetchJob();
  }, [jobId, user, navigate]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!job) {
    return null;
  }

  // Transform PostcardJob to match FlyerJobForm expectations
  const transformedJob = {
    ...job,
    size: job.size as any,
    paper_type: job.paper_type as any,
    paper_weight: job.paper_weight as string,
    status: job.status as "queued" | "batched" | "completed" | "cancelled"
  };

  console.log('Transformed postcard job for form:', transformedJob);

  return <FlyerJobForm mode="edit" initialData={transformedJob} />;
};

export default PostcardJobEdit;
