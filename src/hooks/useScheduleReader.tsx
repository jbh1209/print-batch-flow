/**
 * Hook for reading scheduled job stages (read-only)
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ScheduledStageData {
  id: string;
  job_id: string;
  job_wo_no: string;
  production_stage_id: string;
  stage_name: string;
  stage_order: number;
  estimated_duration_minutes: number;
  scheduled_start_at: string;
  scheduled_end_at: string;
  status: string;
  stage_color?: string;
}

export interface TimeSlotData {
  time_slot: string;
  scheduled_stages: ScheduledStageData[];
}

export interface ScheduleDayData {
  date: string;
  day_name: string;
  time_slots: TimeSlotData[];
  total_stages: number;
  total_minutes: number;
}

export function useScheduleReader() {
  const [scheduleDays, setScheduleDays] = useState<ScheduleDayData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSchedule = useCallback(async () => {
    setIsLoading(true);
    try {
      // Step 1: Fetch scheduled stage instances
      const { data: stageInstances, error: stagesError } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          job_id,
          production_stage_id,
          stage_order,
          estimated_duration_minutes,
          scheduled_start_at,
          scheduled_end_at,
          status,
          job_table_name
        `)
        .not('scheduled_start_at', 'is', null)
        .not('scheduled_end_at', 'is', null)
        .order('scheduled_start_at', { ascending: true });

      if (stagesError) {
        console.error('Error fetching scheduled stages:', stagesError);
        toast.error('Failed to fetch scheduled stages');
        return;
      }

      if (!stageInstances || stageInstances.length === 0) {
        setScheduleDays([]);
        toast.success('No scheduled stages found');
        return;
      }

      // Step 2: Get unique stage and job IDs for batch fetching
      const stageIds = [...new Set(stageInstances.map(s => s.production_stage_id))];
      const jobIds = [...new Set(stageInstances.map(s => s.job_id))];

      // Step 3: Fetch production stages data
      const { data: productionStages, error: stagesLookupError } = await supabase
        .from('production_stages')
        .select('id, name, color')
        .in('id', stageIds);

      if (stagesLookupError) {
        console.error('Error fetching production stages:', stagesLookupError);
      }

      // Step 4: Fetch production jobs data
      const { data: productionJobs, error: jobsError } = await supabase
        .from('production_jobs')
        .select('id, wo_no')
        .in('id', jobIds);

      if (jobsError) {
        console.error('Error fetching production jobs:', jobsError);
      }

      // Step 5: Create lookup maps for fast access
      const stageMap = new Map(
        (productionStages || []).map(stage => [stage.id, stage])
      );
      const jobMap = new Map(
        (productionJobs || []).map(job => [job.id, job])
      );

      // Step 6: Group stages by date and time slot
      const scheduleMap = new Map<string, Map<string, ScheduledStageData[]>>();
      const timeSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
      
      stageInstances.forEach(stageInstance => {
        const startTime = new Date(stageInstance.scheduled_start_at);
        const date = startTime.toISOString().split('T')[0];
        const hour = startTime.getHours();
        const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
        
        // Get related data from lookup maps
        const stage = stageMap.get(stageInstance.production_stage_id);
        const job = jobMap.get(stageInstance.job_id);
        
        if (!scheduleMap.has(date)) {
          scheduleMap.set(date, new Map());
        }
        
        const dayMap = scheduleMap.get(date)!;
        if (!dayMap.has(timeSlot)) {
          dayMap.set(timeSlot, []);
        }
        
        dayMap.get(timeSlot)!.push({
          id: stageInstance.id,
          job_id: stageInstance.job_id,
          job_wo_no: job?.wo_no || 'Unknown',
          production_stage_id: stageInstance.production_stage_id,
          stage_name: stage?.name || 'Unknown Stage',
          stage_order: stageInstance.stage_order,
          estimated_duration_minutes: stageInstance.estimated_duration_minutes || 60,
          scheduled_start_at: stageInstance.scheduled_start_at,
          scheduled_end_at: stageInstance.scheduled_end_at,
          status: stageInstance.status,
          stage_color: stage?.color || '#6B7280'
        });
      });

      // Step 7: Convert to array format
      const scheduleDays: ScheduleDayData[] = [];
      
      scheduleMap.forEach((dayMap, date) => {
        const dateObj = new Date(date);
        const timeSlotData: TimeSlotData[] = timeSlots.map(slot => ({
          time_slot: slot,
          scheduled_stages: dayMap.get(slot) || []
        }));
        
        const totalStages = Array.from(dayMap.values()).flat().length;
        const totalMinutes = Array.from(dayMap.values()).flat()
          .reduce((sum, stage) => sum + stage.estimated_duration_minutes, 0);
        
        scheduleDays.push({
          date,
          day_name: dateObj.toLocaleDateString('en-GB', { weekday: 'long' }),
          time_slots: timeSlotData,
          total_stages: totalStages,
          total_minutes: totalMinutes
        });
      });

      // Sort by date
      scheduleDays.sort((a, b) => a.date.localeCompare(b.date));
      
      setScheduleDays(scheduleDays);
      toast.success(`Loaded schedule with ${stageInstances.length} stages across ${scheduleDays.length} days`);
      
    } catch (error) {
      console.error('Error in fetchSchedule:', error);
      toast.error('Failed to fetch schedule data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const triggerReschedule = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('simple-scheduler');
      
      if (error) {
        console.error('Error triggering reschedule:', error);
        toast.error('Failed to trigger reschedule');
        return false;
      }
      
      toast.success('Reschedule triggered successfully');
      // Refresh the schedule
      await fetchSchedule();
      return true;
      
    } catch (error) {
      console.error('Error in triggerReschedule:', error);
      toast.error('Failed to trigger reschedule');
      return false;
    }
  }, [fetchSchedule]);

  return {
    scheduleDays,
    isLoading,
    fetchSchedule,
    triggerReschedule
  };
}