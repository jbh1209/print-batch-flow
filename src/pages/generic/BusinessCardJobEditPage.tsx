
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productConfigs } from '@/config/productTypes';
import { GenericJobForm } from '@/components/generic/GenericJobForm';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const BusinessCardJobEditPage = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const config = productConfigs["BusinessCards"];

  // Fetch job data first before rendering the form
  const { data: jobData, isLoading } = useQuery({
    queryKey: [`business-card-job-${jobId}`],
    queryFn: async () => {
      if (!jobId) return null;
      
      const { data, error } = await supabase
        .from('business_card_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
        
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="p-8">Loading job details...</div>;
  }

  if (!jobData) {
    return <div className="p-8">Job not found</div>;
  }

  return (
    <GenericJobForm 
      config={config}
      mode="edit"
      initialData={jobData}
    />
  );
};

export default BusinessCardJobEditPage;
