/**
 * Hook for detecting and repairing schedule precedence violations
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PrecedenceViolation {
  job_id: string;
  stage_instance_id: string;
  stage_order: number;
  slot_start_time: string;
  predecessor_stage_instance_id: string;
  predecessor_stage_order: number;
  predecessor_end_time: string;
}

export function useScheduleRepair() {
  const [isLoading, setIsLoading] = useState(false);
  const [violations, setViolations] = useState<PrecedenceViolation[]>([]);

  const findViolations = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('find_precedence_violations');
      
      if (error) {
        console.error('Error finding violations:', error);
        toast.error('Failed to check for violations');
        return;
      }
      
      setViolations(data || []);
      
      if (data && data.length > 0) {
        toast.warning(`Found ${data.length} precedence violations!`, {
          description: `${data.length} stages are scheduled before their predecessors finish`
        });
      } else {
        toast.success('No precedence violations found');
      }
    } catch (error) {
      console.error('Error checking violations:', error);
      toast.error('Failed to check for violations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const repairViolations = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('repair_precedence_violations');
      
      if (error) {
        console.error('Error repairing violations:', error);
        toast.error('Failed to repair violations');
        return false;
      }
      
      const result = data?.[0];
      if (result) {
        toast.success(
          `Repaired violations: cleared ${result.deleted_slots} slots, reset ${result.reset_instances} instances`
        );
        setViolations([]); // Clear local violations list
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error repairing violations:', error);
      toast.error('Failed to repair violations');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fullRepairAndReschedule = useCallback(async () => {
    setIsLoading(true);
    try {
      // Step 1: Repair violations
      console.log('🔧 Step 1: Repairing precedence violations...');
      const repairSuccess = await repairViolations();
      
      if (!repairSuccess) {
        toast.error('Failed to repair violations - aborting reschedule');
        return false;
      }

      // Step 2: Run full reschedule
      console.log('📅 Step 2: Running full reschedule...');
      const { data, error } = await supabase.rpc('simple_scheduler_wrapper', {
        p_mode: 'reschedule_all'
      });
      
      if (error) {
        console.error('Error during reschedule:', error);
        toast.error('Repair succeeded but reschedule failed');
        return false;
      }
      
      const result = data as { scheduled_count: number; wrote_slots: number; success: boolean; mode: string } | null;
      
      // Step 3: Check for new violations
      await findViolations();
      
      toast.success(
        `✅ Emergency repair complete! Rescheduled ${result?.scheduled_count || 0} stages (${result?.wrote_slots || 0} slots)`,
        {
          description: 'Please verify stage precedence is now correct'
        }
      );
      
      return true;
    } catch (error) {
      console.error('Error in full repair:', error);
      toast.error('Emergency repair failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [repairViolations, findViolations]);

  return {
    isLoading,
    violations,
    findViolations,
    repairViolations,
    fullRepairAndReschedule
  };
}