
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GenericJobForm } from "@/components/generic/GenericJobForm";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { productConfigs } from '@/config/productTypes';
import { BaseJob } from '@/config/productTypes';
import { toast } from 'sonner';

const SleeveJobEdit = () => {
  const { jobId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState<BaseJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchJob = async () => {
      if (!user || !jobId) return;

      try {
        const { data, error } = await supabase
          .from('sleeve_jobs')
          .select('*')
          .eq('id', jobId)
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        setJob(data as BaseJob);
      } catch (err) {
        console.error('Error fetching job:', err);
        toast.error('Failed to load job');
        navigate('/batches/sleeves/jobs');
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

  return <GenericJobForm config={productConfigs["Sleeves"]} mode="edit" initialData={job} />;
};

export default SleeveJobEdit;
