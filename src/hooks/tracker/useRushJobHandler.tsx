import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export interface RushJobRequest {
  jobId: string;
  woNo: string;
  customer?: string;
  currentStage: string;
  requestedBy: string;
  reason: string;
  urgencyLevel: 'high' | 'critical' | 'emergency';
  requestedStartTime?: string;
  approvedBy?: string;
  approved?: boolean;
}

export const useRushJobHandler = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showRushModal, setShowRushModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);

  const submitRushRequest = useMutation({
    mutationFn: async (request: RushJobRequest) => {
      // First, mark the job as rush
      const { error: jobUpdateError } = await supabase
        .from('production_jobs')
        .update({ 
          expedited_at: new Date().toISOString(),
          expedited_by: request.requestedBy
        })
        .eq('id', request.jobId);

      if (jobUpdateError) throw jobUpdateError;

      // Log the rush request for audit trail
      const { error: logError } = await supabase
        .from('barcode_scan_log')
        .insert({
          job_id: request.jobId,
          user_id: user?.id || request.requestedBy,
          barcode_data: 'rush_request',
          scan_result: 'success',
          action_taken: `Rush job requested: ${request.reason}`,
        });

      if (logError) throw logError;

      return request;
    },
    onSuccess: (request) => {
      toast({
        title: "Rush Job Requested",
        description: `Rush request submitted for ${request.woNo}. Awaiting supervisor approval.`,
      });
      queryClient.invalidateQueries({ queryKey: ['scheduled-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['personal-next-jobs'] });
      setShowRushModal(false);
      setSelectedJob(null);
    },
    onError: (error) => {
      toast({
        title: "Rush Request Failed",
        description: "Failed to submit rush job request. Please try again.",
        variant: "destructive",
      });
      console.error('Rush request error:', error);
    },
  });

  const approveRushRequest = useMutation({
    mutationFn: async ({ jobId, approvedBy }: { jobId: string; approvedBy: string }) => {
      // Update job approval status
      const { error: updateError } = await supabase
        .from('production_jobs')
        .update({
          expedited_at: new Date().toISOString(),
          expedited_by: approvedBy
        })
        .eq('id', jobId);

      if (updateError) throw updateError;

      // Boost scheduled time for immediate scheduling (since priority_score doesn't exist)
      const newScheduledTime = new Date();
      newScheduledTime.setMinutes(newScheduledTime.getMinutes() + 5); // Schedule 5 minutes from now
      
      const { error: priorityError } = await supabase
        .from('job_stage_instances')
        .update({
          scheduled_start_at: newScheduledTime.toISOString()
        })
        .eq('job_id', jobId)
        .eq('status', 'pending');

      if (priorityError) throw priorityError;

      // Log the approval
      const { error: logError } = await supabase
        .from('barcode_scan_log')
        .insert({
          job_id: jobId,
          user_id: approvedBy,
          barcode_data: 'rush_approval',
          scan_result: 'success',
          action_taken: 'Rush job approved and prioritized'
        });

      if (logError) throw logError;

      return jobId;
    },
    onSuccess: () => {
      toast({
        title: "Rush Job Approved",
        description: "Job has been approved and moved to highest priority.",
      });
      queryClient.invalidateQueries({ queryKey: ['scheduled-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['rush-requests'] });
    },
    onError: (error) => {
      toast({
        title: "Approval Failed",
        description: "Failed to approve rush job request.",
        variant: "destructive",
      });
      console.error('Rush approval error:', error);
    },
  });

  const bypassQueuePosition = useMutation({
    mutationFn: async ({ 
      stageInstanceId, 
      newPosition, 
      reason, 
      approvedBy 
    }: { 
      stageInstanceId: string; 
      newPosition: number; 
      reason: string; 
      approvedBy: string; 
    }) => {
      // Update the scheduled start time to move job earlier in queue
      const newStartTime = new Date();
      newStartTime.setMinutes(newStartTime.getMinutes() + (newPosition * 30)); // 30 min intervals

      const { error: updateError } = await supabase
        .from('job_stage_instances')
        .update({
          scheduled_start_at: newStartTime.toISOString()
        })
        .eq('id', stageInstanceId);

      if (updateError) throw updateError;

      // Log the queue bypass
      const { error: logError } = await supabase
        .from('barcode_scan_log')
        .insert({
          stage_id: stageInstanceId,
          user_id: approvedBy,
          barcode_data: 'queue_bypass',
          scan_result: 'success',
          action_taken: `Queue position bypassed: ${reason}`,
        });

      if (logError) throw logError;

      return stageInstanceId;
    },
    onSuccess: () => {
      toast({
        title: "Queue Updated",
        description: "Job has been moved in the queue successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['scheduled-jobs'] });
    },
    onError: (error) => {
      toast({
        title: "Queue Update Failed",
        description: "Failed to update job queue position.",
        variant: "destructive",
      });
      console.error('Queue bypass error:', error);
    },
  });

  const openRushModal = (job: any) => {
    setSelectedJob(job);
    setShowRushModal(true);
  };

  const closeRushModal = () => {
    setShowRushModal(false);
    setSelectedJob(null);
  };

  return {
    submitRushRequest,
    approveRushRequest,
    bypassQueuePosition,
    showRushModal,
    selectedJob,
    openRushModal,
    closeRushModal,
    isSubmitting: submitRushRequest.isPending,
    isApproving: approveRushRequest.isPending,
    isBypassingQueue: bypassQueuePosition.isPending,
  };
};