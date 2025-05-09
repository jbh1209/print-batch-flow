
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { BusinessCardJob } from '@/types/business-cards';

export function useBusinessCardJobDetails(id?: string) {
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

  const handleViewPDF = () => {
    if (job?.pdf_url) {
      window.open(job.pdf_url, '_blank');
    } else {
      toast.error('No PDF available for this job');
    }
  };

  return { 
    job, 
    isLoading, 
    error,
    handleViewPDF
  };
}
