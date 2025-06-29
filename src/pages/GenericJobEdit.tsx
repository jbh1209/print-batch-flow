
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
  const { id } = useParams(); // Changed from jobId to id to match route pattern
  const { user } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState<BaseJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchJob = async () => {
      if (!user || !id) return;

      try {
        let data: any = null;
        let error: any = null;

        switch (config.tableName) {
          case 'poster_jobs':
            const posterResult = await supabase
              .from('poster_jobs')
              .select('*')
              .eq('id', id)
              .single();
            data = posterResult.data;
            error = posterResult.error;
            break;
          case 'box_jobs':
            const boxResult = await supabase
              .from('box_jobs')
              .select('*')
              .eq('id', id)
              .single();
            data = boxResult.data;
            error = boxResult.error;
            break;
          case 'cover_jobs':
            const coverResult = await supabase
              .from('cover_jobs')
              .select('*')
              .eq('id', id)
              .single();
            data = coverResult.data;
            error = coverResult.error;
            break;
          case 'sticker_jobs':
            const stickerResult = await supabase
              .from('sticker_jobs')
              .select('*')
              .eq('id', id)
              .single();
            data = stickerResult.data;
            error = stickerResult.error;
            break;
          default:
            throw new Error(`Unsupported table: ${config.tableName}`);
        }

        if (error) throw error;
        
        console.log(`Fetched ${config.tableName} job data:`, data);
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
  }, [id, user, navigate, config]);

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
