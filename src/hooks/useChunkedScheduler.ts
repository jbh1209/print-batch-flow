/**
 * Chunked scheduler for handling large reschedule operations without timeouts
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SchedulerChunkResult {
  updated_jsi: number;
  wrote_slots: number;
  violations?: string[];
}

interface ChunkProgress {
  totalJobs: number;
  processed: number;
  succeeded: number;
  failed: number;
  failures: { index: number; jobIds: string[]; error: string }[];
}

interface ChunkedSchedulerOptions {
  chunkSize?: number;
}

function isSchedulerChunkResult(x: unknown): x is SchedulerChunkResult {
  return (
    typeof x === 'object' &&
    x !== null &&
    'updated_jsi' in x &&
    'wrote_slots' in x &&
    typeof (x as any).updated_jsi === 'number' &&
    typeof (x as any).wrote_slots === 'number'
  );
}

export function useChunkedScheduler() {
  const [isLoading, setIsLoading] = useState(false);

  const fetchPendingJobIds = useCallback(async (): Promise<string[]> => {
    const { data, error } = await supabase
      .from('job_stage_instances')
      .select('job_id')
      .eq('status', 'pending')
      .eq('job_table_name', 'production_jobs');

    if (error) {
      throw new Error(`Failed to fetch pending jobs: ${error.message}`);
    }

    // Client-side dedupe for uniqueness
    const uniqueJobIds = [...new Set(data.map(row => row.job_id))];
    return uniqueJobIds;
  }, []);

  const clearPreviousSchedule = useCallback(async () => {
    const { error } = await supabase.rpc('clear_non_completed_scheduling_data');
    if (error) {
      throw new Error(`Failed to clear schedule: ${error.message}`);
    }
  }, []);

  const processChunk = useCallback(async (
    jobIds: string[],
    retryCount = 0
  ): Promise<SchedulerChunkResult> => {
    try {
      const { data, error } = await supabase.rpc('scheduler_append_jobs', {
        p_job_ids: jobIds,
        p_start_from: null,
        p_only_if_unset: true
      });

      if (error) {
        // Retry once on timeout (code 57014)
        if (error.code === '57014' && retryCount === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1s backoff
          return processChunk(jobIds, retryCount + 1);
        }
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!isSchedulerChunkResult(row)) {
        throw new Error('Invalid response format from scheduler');
      }

      return row;
    } catch (error) {
      throw error;
    }
  }, []);

  const rescheduleAllChunked = useCallback(async () => {
    setIsLoading(true);
    try {
      // Call the original working SQL function directly (no Edge Function wrapper)
      const { data, error } = await supabase.rpc('scheduler_reschedule_all_parallel_aware');

      if (error) {
        throw new Error(`Reschedule failed: ${error.message}`);
      }

      const result = Array.isArray(data) ? data[0] : data;
      if (!isSchedulerChunkResult(result)) {
        throw new Error('Invalid response format from scheduler');
      }

      return {
        totals: result,
        progress: { totalJobs: result.updated_jsi, processed: result.updated_jsi, succeeded: result.updated_jsi, failed: 0, failures: [] }
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const appendJobsChunked = useCallback(async (
    jobIds: string[],
    opts: ChunkedSchedulerOptions = {}
  ) => {
    const { chunkSize = 25 } = opts;
    
    setIsLoading(true);
    try {
      if (jobIds.length === 0) {
        return {
          totals: { updated_jsi: 0, wrote_slots: 0, violations: [] },
          progress: { totalJobs: 0, processed: 0, succeeded: 0, failed: 0, failures: [] }
        };
      }

      // Process in chunks
      const chunks = [];
      for (let i = 0; i < jobIds.length; i += chunkSize) {
        chunks.push(jobIds.slice(i, i + chunkSize));
      }

      const progress: ChunkProgress = {
        totalJobs: jobIds.length,
        processed: 0,
        succeeded: 0,
        failed: 0,
        failures: []
      };

      const totals: SchedulerChunkResult = {
        updated_jsi: 0,
        wrote_slots: 0,
        violations: []
      };

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        try {
          const result = await processChunk(chunk);
          
          totals.updated_jsi += result.updated_jsi;
          totals.wrote_slots += result.wrote_slots;
          if (result.violations) {
            totals.violations = [...(totals.violations || []), ...result.violations];
          }

          progress.succeeded += chunk.length;
          progress.processed += chunk.length;
        } catch (error) {
          progress.failed += chunk.length;
          progress.processed += chunk.length;
          progress.failures.push({
            index: i,
            jobIds: chunk,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      return { totals, progress };
    } finally {
      setIsLoading(false);
    }
  }, [processChunk]);

  return {
    isLoading,
    rescheduleAllChunked,
    appendJobsChunked
  };
}