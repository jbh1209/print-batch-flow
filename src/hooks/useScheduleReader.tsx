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
      // Fetch all scheduled stages for the next 30 days
      const { data: stages, error } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          job_id,
          stage_order,
          estimated_duration_minutes,
          scheduled_start_at,
          scheduled_end_at,
          status,
          production_stages!inner(name, color),
          production_jobs!inner(wo_no)
        `)
        .not('scheduled_start_at', 'is', null)
        .not('scheduled_end_at', 'is', null)
        .gte('scheduled_start_at', new Date().toISOString())
        .order('scheduled_start_at', { ascending: true });

      if (error) {
        console.error('Error fetching scheduled stages:', error);
        toast.error('Failed to fetch schedule');
        return;
      }

      // Group stages by date and time slot
      const scheduleMap = new Map<string, Map<string, ScheduledStageData[]>>();
      
      (stages || []).forEach(stage => {
        const startTime = new Date(stage.scheduled_start_at);
        const date = startTime.toISOString().split('T')[0];
        const hour = startTime.getHours();
        const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
        
        if (!scheduleMap.has(date)) {
          scheduleMap.set(date, new Map());
        }
        
        const dayMap = scheduleMap.get(date)!;
        if (!dayMap.has(timeSlot)) {
          dayMap.set(timeSlot, []);
        }
        
        dayMap.get(timeSlot)!.push({
          id: stage.id,
          job_id: stage.job_id,
          job_wo_no: (stage.production_jobs as any)?.wo_no || 'Unknown',
          stage_name: (stage.production_stages as any)?.name || 'Unknown Stage',
          stage_order: stage.stage_order,
          estimated_duration_minutes: stage.estimated_duration_minutes || 60,
          scheduled_start_at: stage.scheduled_start_at,
          scheduled_end_at: stage.scheduled_end_at,
          status: stage.status,
          stage_color: (stage.production_stages as any)?.color || '#6B7280'
        });
      });

      // Convert to array format
      const scheduleDays: ScheduleDayData[] = [];
      const timeSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
      
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
      toast.success(`Loaded schedule with ${stages?.length || 0} stages`);
      
    } catch (error) {
      console.error('Error in fetchSchedule:', error);
      toast.error('Failed to fetch schedule');
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