
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProofUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  stageInstanceId: string;
  onProofSent: () => void;
}

const ProofUploadDialog: React.FC<ProofUploadDialogProps> = ({
  isOpen,
  onClose,
  stageInstanceId,
  onProofSent
}) => {
  const [customerEmail, setCustomerEmail] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleSendProof = async () => {
    if (!customerEmail.trim()) {
      toast.error("Please enter customer email");
      return;
    }

    setIsSending(true);
    try {
      // Generate proof link
      const { data: linkData, error: linkError } = await supabase.functions.invoke(
        'handle-proof-approval/generate-link',
        { body: { stageInstanceId } }
      );

      if (linkError || !linkData) {
        toast.error("Failed to generate proof link");
        return;
      }

      // Get job details for email
      const { data: stageInstance } = await supabase
        .from('job_stage_instances')
        .select(`
          job_id,
          job_table_name,
          production_jobs!inner(wo_no, customer, name)
        `)
        .eq('id', stageInstanceId)
        .single();

      const jobDetails = {
        jobNumber: stageInstance?.production_jobs?.wo_no,
        customer: stageInstance?.production_jobs?.customer,
        description: jobDescription || stageInstance?.production_jobs?.name
      };

      // Send email
      const { error: emailError } = await supabase.functions.invoke('send-proof-email', {
        body: {
          proofUrl: linkData.proofUrl,
          customerEmail: customerEmail.trim(),
          jobDetails
        }
      });

      if (emailError) {
        toast.error("Failed to send email");
        return;
      }

      // Mark proof as emailed
      await supabase
        .from('job_stage_instances')
        .update({
          proof_emailed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', stageInstanceId);

      toast.success("Proof email sent successfully!");
      onProofSent();
      onClose();
      setCustomerEmail("");
      setJobDescription("");
    } catch (error) {
      console.error("Error sending proof:", error);
      toast.error("Failed to send proof");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Proof to Client
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="email">Customer Email *</Label>
            <Input
              id="email"
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="customer@example.com"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Job Description (optional)</Label>
            <Textarea
              id="description"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Brief description of the job..."
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSendProof}
              disabled={isSending || !customerEmail.trim()}
              className="flex-1"
            >
              <Mail className="h-4 w-4 mr-2" />
              {isSending ? 'Sending...' : 'Send Proof Email'}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProofUploadDialog;
