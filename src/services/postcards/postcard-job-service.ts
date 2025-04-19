
import { supabase } from '@/integrations/supabase/client';
import { PostcardJob, PaperType } from '@/components/batches/types/PostcardTypes';

export async function deletePostcardJob(jobId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('postcard_jobs')
    .delete()
    .eq('id', jobId)
    .eq('user_id', userId);

  if (error) throw error;
  return true;
}

export async function createPostcardJobRecord(jobData: {
  name: string;
  job_number: string;
  size: string;
  paper_type: PaperType;
  paper_weight: string;
  lamination_type: string;
  double_sided: boolean;
  quantity: number;
  due_date: string;
  pdf_url: string;
  file_name: string;
  user_id: string;
}) {
  const { data, error } = await supabase
    .from('postcard_jobs')
    .insert({
      ...jobData,
      status: 'queued'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

