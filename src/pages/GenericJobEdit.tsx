
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GenericJobForm } from "@/components/generic/GenericJobForm";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ProductConfig, BaseJob } from '@/config/productTypes';
import { toast } from 'sonner';

interface GenericJobEditProps {
  config: ProductConfig;
}

const GenericJobEdit = ({ config }: GenericJobEditProps) => {
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
          .from(config.tableName)
          .select('*')
          .eq('id', jobId)
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        setJob(data as BaseJob);
      } catch (err) {
        console.error('Error fetching job:', err);
        toast.error('Failed to load job');
        navigate(config.routes.jobsPath);
      } finally {
        setIsLoading(false);
      }
    };

    fetchJob();
  }, [jobId, user, navigate, config]);

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

  return <GenericJobForm config={config} mode="edit" initialData={job} />;
};

export default GenericJobEdit;
