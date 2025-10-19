import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ShippingCompletion, ShippingCompletionFormData } from "@/components/tracker/factory/shipping/types";

export const useShippingCompletion = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getShippingHistory = async (jobId: string): Promise<ShippingCompletion[]> => {
    const { data, error } = await supabase
      .from('shipping_completions')
      .select('*')
      .eq('job_id', jobId)
      .order('shipment_number', { ascending: true });

    if (error) {
      console.error('Error fetching shipping history:', error);
      return [];
    }

    return (data || []) as ShippingCompletion[];
  };

  const submitShippingCompletion = async (
    jobId: string,
    stageInstanceId: string,
    jobQty: number,
    formData: ShippingCompletionFormData,
    onSuccess: () => void
  ): Promise<boolean> => {
    setIsSubmitting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Authentication required');
        return false;
      }

      // Get existing shipments
      const existingShipments = await getShippingHistory(jobId);
      const totalPreviouslyShipped = existingShipments.reduce((sum, s) => sum + s.qty_shipped, 0);
      const remainingQty = jobQty - totalPreviouslyShipped;

      // Validate quantity
      if (formData.qtyShipped > remainingQty) {
        toast.error(`Cannot ship ${formData.qtyShipped} - only ${remainingQty} units remaining`);
        return false;
      }

      // Validate courier waybill for courier deliveries
      if (formData.deliveryMethod === 'courier' && !formData.courierWaybillNumber.trim()) {
        toast.error('Courier waybill number is required for courier deliveries');
        return false;
      }

      const newTotalShipped = totalPreviouslyShipped + formData.qtyShipped;
      const isFullyShipped = newTotalShipped >= jobQty;
      const shipmentNumber = existingShipments.length + 1;

      // Insert shipping completion record
      const { error: insertError } = await supabase
        .from('shipping_completions')
        .insert({
          job_id: jobId,
          stage_instance_id: stageInstanceId,
          shipment_number: shipmentNumber,
          qty_shipped: formData.qtyShipped,
          qe_dn_number: formData.qeDnNumber,
          courier_waybill_number: formData.courierWaybillNumber || null,
          courier_waybill_url: formData.courierWaybillUrl || null,
          delivery_method: formData.deliveryMethod,
          notes: formData.notes || null,
          shipped_by: user.id
        });

      if (insertError) {
        console.error('Error inserting shipping completion:', insertError);
        toast.error('Failed to record shipment');
        return false;
      }

      // Update production_jobs
      const { error: jobUpdateError } = await supabase
        .from('production_jobs')
        .update({
          total_qty_shipped: newTotalShipped,
          is_partially_shipped: !isFullyShipped,
          final_delivery_method: formData.deliveryMethod
        })
        .eq('id', jobId);

      if (jobUpdateError) {
        console.error('Error updating job:', jobUpdateError);
        toast.error('Failed to update job');
        return false;
      }

      if (isFullyShipped) {
        // Complete the stage and job
        const { completeJobStage } = await import('./useAccessibleJobs/utils/jobCompletionUtils');
        const success = await completeJobStage(jobId, stageInstanceId);
        
        if (success) {
          toast.success(`Final shipment recorded - Job completed!`);
          onSuccess();
          return true;
        } else {
          toast.error('Failed to complete job stage');
          return false;
        }
      } else {
        // Partial shipment - update stage notes
        const { error: stageUpdateError } = await supabase
          .from('job_stage_instances')
          .update({
            notes: `Partial shipment ${shipmentNumber}: ${formData.qtyShipped} units shipped. ${jobQty - newTotalShipped} remaining.`,
            updated_at: new Date().toISOString()
          })
          .eq('id', stageInstanceId);

        if (stageUpdateError) {
          console.error('Error updating stage:', stageUpdateError);
        }

        toast.success(`Shipment ${shipmentNumber} recorded - ${jobQty - newTotalShipped} units remaining`);
        onSuccess();
        return true;
      }
    } catch (error) {
      console.error('Error in shipping completion:', error);
      toast.error('Failed to process shipment');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isSubmitting,
    getShippingHistory,
    submitShippingCompletion
  };
};
