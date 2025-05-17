
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ProductConfig, BaseJob } from '@/config/productTypes';
import { GenericJobForm } from '@/components/generic/GenericJobForm';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface GenericJobEditPageProps {
  config: ProductConfig;
}

const GenericJobEditPage: React.FC<GenericJobEditPageProps> = ({ config }) => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const {
    data: job,
    isLoading,
    error,
  } = useQuery({
    queryKey: [`${config.productType.toLowerCase()}-job-edit-${jobId}`],
    queryFn: async () => {
      if (!jobId || !user) {
        console.error('Missing job ID or user');
        return null;
      }
      
      try {
        console.log(`Fetching ${config.productType} job with ID: ${jobId}`);
        
        const { data, error } = await supabase
          .from(config.tableName as any)
          .select('*')
          .eq('id', jobId)
          .single();
          
        if (error) throw error;
        
        if (!data) {
          throw new Error('Job not found');
        }
        
        return data as unknown as BaseJob;
      } catch (err) {
        console.error(`Error fetching ${config.productType} job:`, err);
        throw err;
      }
    },
    retry: 1,
    staleTime: 30000
  });
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-gray-300 mb-4" />
        <h3 className="font-medium text-lg mb-1">Loading job details...</h3>
        <p className="text-sm text-gray-400">Please wait while we fetch the job data</p>
      </div>
    );
  }
  
  if (error || !job) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto my-8">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error loading job</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Job not found or you don\'t have permission to view it.'}
          <div className="mt-4">
            <button 
              className="bg-white text-red-600 px-4 py-2 rounded border border-current"
              onClick={() => navigate(config.routes.jobsPath)}
            >
              Return to Jobs List
            </button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <div className="container mx-auto py-6">
      <GenericJobForm 
        config={config}
        mode="edit"
        initialData={job}
      />
    </div>
  );
};

export default GenericJobEditPage;
