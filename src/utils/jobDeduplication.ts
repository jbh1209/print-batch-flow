
import { formatWONumber } from "./woNumberFormatter";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DuplicateJobInfo {
  id: string;
  wo_no: string;
  customer: string;
  created_at: string;
}

export const findDuplicateJobs = async (): Promise<DuplicateJobInfo[][]> => {
  try {
    const { data: jobs, error } = await supabase
      .from('production_jobs')
      .select('id, wo_no, customer, created_at')
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Group jobs by normalized WO number
    const jobGroups = new Map<string, DuplicateJobInfo[]>();
    
    jobs?.forEach((job) => {
      const normalizedWO = formatWONumber(job.wo_no);
      if (!normalizedWO) return;
      
      if (!jobGroups.has(normalizedWO)) {
        jobGroups.set(normalizedWO, []);
      }
      jobGroups.get(normalizedWO)!.push({
        id: job.id,
        wo_no: job.wo_no,
        customer: job.customer || 'Unknown',
        created_at: job.created_at
      });
    });

    // Return only groups with duplicates
    return Array.from(jobGroups.values()).filter(group => group.length > 1);
  } catch (error) {
    console.error('Error finding duplicate jobs:', error);
    return [];
  }
};

export const mergeDuplicateJobs = async (jobsToKeep: string[], jobsToRemove: string[]): Promise<boolean> => {
  try {
    console.log('Merging duplicate jobs:', { jobsToKeep, jobsToRemove });
    
    // Delete the duplicate jobs
    const { error } = await supabase
      .from('production_jobs')
      .delete()
      .in('id', jobsToRemove);

    if (error) throw error;

    toast.success(`Successfully removed ${jobsToRemove.length} duplicate job(s)`);
    return true;
  } catch (error) {
    console.error('Error merging duplicate jobs:', error);
    toast.error('Failed to merge duplicate jobs');
    return false;
  }
};

export const checkParsedJobsForDuplicates = async (parsedJobs: any[]): Promise<{ newJobs: typeof parsedJobs; duplicates: typeof parsedJobs; existingWONumbers: Set<string> }> => {
  try {
    // Get all existing WO numbers from database
    const { data: existingJobs, error } = await supabase
      .from('production_jobs')
      .select('wo_no');

    if (error) throw error;

    // Create a set of normalized existing WO numbers for fast lookup
    const existingWONumbers = new Set<string>();
    existingJobs?.forEach(job => {
      const normalized = formatWONumber(job.wo_no);
      if (normalized) {
        existingWONumbers.add(normalized);
      }
    });

    // Separate new jobs from duplicates
    const newJobs: typeof parsedJobs = [];
    const duplicates: typeof parsedJobs = [];

    parsedJobs.forEach(job => {
      const normalizedWO = formatWONumber(job.wo_no);
      if (normalizedWO && existingWONumbers.has(normalizedWO)) {
        duplicates.push(job);
      } else {
        newJobs.push(job);
      }
    });

    console.log(`Duplicate check complete: ${newJobs.length} new jobs, ${duplicates.length} duplicates found`);
    
    return { newJobs, duplicates, existingWONumbers };
  } catch (error) {
    console.error('Error checking for duplicates:', error);
    // Return all jobs as new if check fails
    return { newJobs: parsedJobs, duplicates: [], existingWONumbers: new Set() };
  }
};

export const normalizeAllWONumbers = async (): Promise<boolean> => {
  try {
    console.log('Normalizing all WO numbers...');
    
    const { data: jobs, error: fetchError } = await supabase
      .from('production_jobs')
      .select('id, wo_no');

    if (fetchError) throw fetchError;

    const updates = jobs?.map(job => ({
      id: job.id,
      wo_no: formatWONumber(job.wo_no)
    })).filter(job => job.wo_no !== jobs?.find(j => j.id === job.id)?.wo_no);

    if (!updates || updates.length === 0) {
      toast.info('All WO numbers are already normalized');
      return true;
    }

    // Update in batches
    for (const update of updates) {
      const { error } = await supabase
        .from('production_jobs')
        .update({ wo_no: update.wo_no })
        .eq('id', update.id);

      if (error) throw error;
    }

    toast.success(`Normalized ${updates.length} WO number(s)`);
    return true;
  } catch (error) {
    console.error('Error normalizing WO numbers:', error);
    toast.error('Failed to normalize WO numbers');
    return false;
  }
};
