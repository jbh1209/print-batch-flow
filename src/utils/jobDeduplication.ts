import { supabase } from '@/integrations/supabase/client';
import type { ParsedJob } from './excel/types';

export interface DuplicateCheckResult {
  duplicates: Array<{ wo_no: string }>;
  newJobs: Array<{ wo_no: string }>;
}

export interface DuplicateJobInfo {
  id: string;
  wo_no: string;
  customer: string;
  reference: string;
  status: string;
  created_at: string;
}

export const checkParsedJobsForDuplicates = async (
  jobs: Array<{ wo_no: string }>
): Promise<DuplicateCheckResult> => {
  if (jobs.length === 0) {
    return { duplicates: [], newJobs: [] };
  }

  const woNumbers = jobs.map(job => job.wo_no);
  
  // Query existing jobs to find duplicates
  const { data: existingJobs, error } = await supabase
    .from('production_jobs')
    .select('wo_no')
    .in('wo_no', woNumbers);

  if (error) {
    console.error('Error checking for duplicates:', error);
    // If we can't check, assume all are new to prevent data loss
    return { duplicates: [], newJobs: jobs };
  }

  const existingWONumbers = new Set(existingJobs?.map(job => job.wo_no) || []);
  
  const duplicates = jobs.filter(job => existingWONumbers.has(job.wo_no));
  const newJobs = jobs.filter(job => !existingWONumbers.has(job.wo_no));

  return { duplicates, newJobs };
};

export const findDuplicateJobs = async (): Promise<DuplicateJobInfo[][]> => {
  const { data: jobs, error } = await supabase
    .from('production_jobs')
    .select('id, wo_no, customer, reference, status, created_at')
    .order('wo_no');

  if (error) {
    console.error('Error finding duplicate jobs:', error);
    return [];
  }

  const groups = new Map<string, DuplicateJobInfo[]>();
  
  jobs?.forEach(job => {
    if (!groups.has(job.wo_no)) {
      groups.set(job.wo_no, []);
    }
    groups.get(job.wo_no)!.push(job);
  });

  // Return only groups with more than one job (duplicates)
  return Array.from(groups.values()).filter(group => group.length > 1);
};

export const mergeDuplicateJobs = async (jobIds: string[], keepJobId: string): Promise<boolean> => {
  try {
    // Delete all duplicate jobs except the one to keep
    const jobsToDelete = jobIds.filter(id => id !== keepJobId);
    
    const { error } = await supabase
      .from('production_jobs')
      .delete()
      .in('id', jobsToDelete);

    if (error) {
      console.error('Error merging duplicate jobs:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error merging duplicate jobs:', error);
    return false;
  }
};

export const normalizeAllWONumbers = async (): Promise<boolean> => {
  try {
    // Get all jobs
    const { data: jobs, error: fetchError } = await supabase
      .from('production_jobs')
      .select('id, wo_no, user_id');

    if (fetchError) {
      console.error('Error fetching jobs for normalization:', fetchError);
      return false;
    }

    // Normalize WO numbers (basic implementation)
    const updates = jobs?.map(job => ({
      id: job.id,
      wo_no: job.wo_no.trim().toUpperCase(),
      user_id: job.user_id
    })) || [];

    if (updates.length > 0) {
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('production_jobs')
          .update({ wo_no: update.wo_no })
          .eq('id', update.id);

        if (updateError) {
          console.error('Error normalizing WO number:', updateError);
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Error normalizing WO numbers:', error);
    return false;
  }
};