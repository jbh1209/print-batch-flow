
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useJobSpecificationDisplay } from '@/hooks/useJobSpecificationDisplay';
import { toast } from 'sonner';

interface PostcardJob {
  id: string;
  name: string;
  job_number: string;
  pdf_url: string;
  file_name: string;
  quantity: number;
  due_date: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  batch_id?: string;
  batch_ready: boolean;
  batch_allocated_at?: string;
  batch_allocated_by?: string;
  status: string;
  // Specification properties
  size?: string;
  paper_weight?: string;
  paper_type?: string;
}

const PostcardJobEdit = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState<PostcardJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { getJobSpecifications } = useJobSpecificationDisplay();

  useEffect(() => {
    const fetchJob = async () => {
      if (!id) return;

      try {
        const { data, error } = await supabase
          .from('postcard_jobs')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) throw error;
        
        if (!data) {
          toast.error('Job not found');
          navigate('/batchflow/batches/postcards?tab=jobs');
          return;
        }

        // Get specifications for this job
        const specifications = await getJobSpecifications(id, 'postcard_jobs');
        
        // Combine job data with specifications
        const jobWithSpecs: PostcardJob = {
          ...data,
          size: specifications.size || 'Not specified',
          paper_type: specifications.paper_type || 'Not specified',
          paper_weight: specifications.paper_weight || 'Not specified'
        };
        
        setJob(jobWithSpecs);
      } catch (err) {
        console.error('Error fetching job:', err);
        toast.error('Failed to load job');
        navigate('/batchflow/batches/postcards?tab=jobs');
      } finally {
        setIsLoading(false);
      }
    };

    fetchJob();
  }, [id, navigate, getJobSpecifications]);

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

  return (
    <div className="container mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Edit Postcard Job</h1>
      <div className="bg-white rounded-lg border shadow p-6">
        <p>Job: {job.name}</p>
        <p>Quantity: {job.quantity}</p>
        <p>Size: {job.size || 'Not specified'}</p>
        <p>Paper Type: {job.paper_type || 'Not specified'}</p>
        <p>Paper Weight: {job.paper_weight || 'Not specified'}</p>
        {/* Add your edit form here */}
      </div>
    </div>
  );
};

export default PostcardJobEdit;
