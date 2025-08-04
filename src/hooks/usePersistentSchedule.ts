import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DynamicDaySchedule, DynamicScheduledJob } from '@/services/dynamicProductionScheduler';
import { enhanceSupabaseError, logApiCall } from '@/utils/errorLogging';

interface PersistentScheduleEntry {
  id: string;
  job_id: string;
  job_table_name: string;
  production_stage_id: string;
  scheduled_date: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  queue_position: number;
  shift_number: number;
  estimated_duration_minutes?: number;
  version: number;
}

export const usePersistentSchedule = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveSchedule = useCallback(async (
    weekStart: Date,
    stageId: string,
    schedule: DynamicDaySchedule[]
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      // Convert schedule to database entries
      const scheduleEntries: Omit<PersistentScheduleEntry, 'id' | 'version'>[] = [];
      
      schedule.forEach((daySchedule, dayIndex) => {
        const scheduleDate = new Date(weekStart);
        scheduleDate.setDate(scheduleDate.getDate() + dayIndex);
        
        daySchedule.jobs.forEach((job, jobIndex) => {
          scheduleEntries.push({
            job_id: job.id,
            job_table_name: 'production_jobs',
            production_stage_id: stageId,
            scheduled_date: scheduleDate.toISOString().split('T')[0],
            queue_position: jobIndex + 1,
            shift_number: 1, // Default shift
            estimated_duration_minutes: job.estimated_minutes || null,
            scheduled_start_time: job.scheduled_start_time || null,
            scheduled_end_time: job.scheduled_end_time || null,
          });
        });
      });

      if (scheduleEntries.length === 0) {
        return true; // No jobs to schedule
      }

      // Delete existing schedule for this week/stage
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      await supabase
        .from('production_job_schedules')
        .delete()
        .eq('production_stage_id', stageId)
        .gte('scheduled_date', weekStart.toISOString().split('T')[0])
        .lte('scheduled_date', weekEnd.toISOString().split('T')[0]);

      // Insert new schedule
      const { error: insertError } = await supabase
        .from('production_job_schedules')
        .insert(scheduleEntries);

      if (insertError) throw insertError;

      return true;
    } catch (err) {
      console.error('Error saving persistent schedule:', err);
      setError(err instanceof Error ? err.message : 'Failed to save schedule');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadSchedule = useCallback(async (
    weekStart: Date,
    stageId: string
  ): Promise<DynamicDaySchedule[] | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      logApiCall('GET', `production_job_schedules for stage ${stageId}`);
      const { data: scheduleData, error: fetchError } = await supabase
        .from('production_job_schedules')
        .select(`
          *,
          production_jobs!left(
            id,
            wo_no,
            customer,
            status,
            due_date,
            qty,
            reference
          )
        `)
        .eq('production_stage_id', stageId)
        .gte('scheduled_date', weekStart.toISOString().split('T')[0])
        .lte('scheduled_date', weekEnd.toISOString().split('T')[0])
        .order('scheduled_date')
        .order('shift_number')
        .order('queue_position');

      if (fetchError) {
        enhanceSupabaseError(fetchError, 'Loading persistent schedule');
        throw fetchError;
      }

      if (!scheduleData || scheduleData.length === 0) {
        return null; // No persisted schedule found
      }

      // Convert database entries back to schedule format
      const scheduleByDate: Record<string, DynamicDaySchedule> = {};
      
      scheduleData.forEach((entry: any) => {
        // Skip entries with missing production job data
        if (!entry.production_jobs) {
          console.warn(`⚠️ Skipping schedule entry ${entry.id} - production job not found`);
          return;
        }

        const dateKey = entry.scheduled_date;
        if (!scheduleByDate[dateKey]) {
          scheduleByDate[dateKey] = {
            date: entry.scheduled_date,
            stage_id: stageId,
            stage_name: '',
            jobs: [],
            shifts: [],
            total_hours: 0,
            total_minutes: 0,
            capacity_hours: 8,
            capacity_minutes: 480,
            utilization: 0,
            is_working_day: true,
            available_capacity: 480
          };
        }

        // Add job directly to day
        const job: DynamicScheduledJob = {
          id: entry.job_id,
          wo_no: entry.production_jobs.wo_no || 'Unknown',
          customer: entry.production_jobs.customer || 'Unknown',
          status: entry.production_jobs.status || 'Unknown',
          estimated_minutes: entry.estimated_duration_minutes || 60,
          estimated_hours: (entry.estimated_duration_minutes || 60) / 60,
          scheduled_date: entry.scheduled_date,
          scheduled_start_time: entry.scheduled_start_time,
          scheduled_end_time: entry.scheduled_end_time,
          priority: entry.queue_position,
          is_expedited: false,
          current_stage_id: stageId,
          current_stage_name: '',
          stage_status: 'pending' as const,
          accessibleJob: entry.production_jobs,
          due_date: entry.production_jobs.due_date ? new Date(entry.production_jobs.due_date) : new Date(),
          stage_order: 1,
          queue_position: entry.queue_position
        };

        scheduleByDate[dateKey].jobs.push(job);
      });

      // Convert to result array and recalculate totals
      const result: DynamicDaySchedule[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        const dateKey = date.toISOString().split('T')[0];
        
        if (scheduleByDate[dateKey]) {
          const daySchedule = scheduleByDate[dateKey];
          
          // Recalculate totals
          daySchedule.total_hours = daySchedule.jobs.reduce((sum, job) => sum + job.estimated_hours, 0);
          daySchedule.total_minutes = daySchedule.total_hours * 60;
          daySchedule.utilization = Math.round((daySchedule.total_hours / daySchedule.capacity_hours) * 100);
          
          result.push(daySchedule);
        } else {
          // Create empty day
          result.push({
            date: dateKey,
            stage_id: stageId,
            stage_name: '',
            jobs: [],
            shifts: [],
            total_hours: 0,
            total_minutes: 0,
            capacity_hours: 8,
            capacity_minutes: 480,
            utilization: 0,
            is_working_day: true,
            available_capacity: 480
          });
        }
      }

      return result;
    } catch (err) {
      console.error('Error loading persistent schedule:', err);
      setError(err instanceof Error ? err.message : 'Failed to load schedule');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateJobPosition = useCallback(async (
    jobId: string,
    stageId: string,
    newDate: Date,
    newShift: number,
    newPosition: number
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('production_job_schedules')
        .update({
          scheduled_date: newDate.toISOString().split('T')[0],
          shift_number: newShift,
          queue_position: newPosition,
          updated_at: new Date().toISOString()
        })
        .eq('job_id', jobId)
        .eq('production_stage_id', stageId);

      if (updateError) throw updateError;

      return true;
    } catch (err) {
      console.error('Error updating job position:', err);
      setError(err instanceof Error ? err.message : 'Failed to update job position');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearSchedule = useCallback(async (weekStart: Date, stageId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const { error: deleteError } = await supabase
        .from('production_job_schedules')
        .delete()
        .eq('production_stage_id', stageId)
        .gte('scheduled_date', weekStart.toISOString().split('T')[0])
        .lte('scheduled_date', weekEnd.toISOString().split('T')[0]);

      if (deleteError) throw deleteError;

      return true;
    } catch (err) {
      console.error('Error clearing schedule:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear schedule');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    saveSchedule,
    loadSchedule,
    updateJobPosition,
    clearSchedule,
    isLoading,
    error
  };
};