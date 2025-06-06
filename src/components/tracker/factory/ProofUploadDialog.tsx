
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
import { Upload, Mail, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useFileUpload } from "@/hooks/useFileUpload";

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
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const { selectedFile, handleFileChange, fileInfo } = useFileUpload({
    acceptedTypes: ["application/pdf"],
    maxSizeInMB: 50
  });

  const uploadProofPdf = async (file: File): Promise<string | null> => {
    try {
      const fileName = `proof_${stageInstanceId}_${Date.now()}.pdf`;
      const filePath = `proofs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('job-files')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('job-files')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading proof PDF:', error);
      return null;
    }
  };

  const handleSendProof = async () => {
    if (!customerEmail.trim()) {
      toast.error("Please enter customer email");
      return;
    }

    if (!customerName.trim()) {
      toast.error("Please enter customer name");
      return;
    }

    if (!selectedFile) {
      toast.error("Please upload a proof PDF");
      return;
    }

    setIsUploading(true);
    setIsSending(true);
    
    try {
      // Upload the proof PDF
      const proofPdfUrl = await uploadProofPdf(selectedFile);
      if (!proofPdfUrl) {
        toast.error("Failed to upload proof PDF");
        return;
      }

      // Update stage instance with proof PDF URL
      await supabase
        .from('job_stage_instances')
        .update({ proof_pdf_url: proofPdfUrl })
        .eq('id', stageInstanceId);

      // Generate proof link
      const { data: linkData, error: linkError } = await supabase.functions.invoke(
        'handle-proof-approval/generate-link',
        { body: { stageInstanceId } }
      );

      if (linkError || !linkData) {
        toast.error("Failed to generate proof link");
        return;
      }

      // Get stage instance details first
      const { data: stageInstance, error: stageError } = await supabase
        .from('job_stage_instances')
        .select('job_id, job_table_name')
        .eq('id', stageInstanceId)
        .single();

      if (stageError || !stageInstance) {
        toast.error("Failed to get stage instance details");
        return;
      }

      // Get job details from the appropriate table
      let jobDetails = null;
      if (stageInstance.job_table_name === 'production_jobs') {
        const { data: job, error: jobError } = await supabase
          .from('production_jobs')
          .select('wo_no, customer, reference')
          .eq('id', stageInstance.job_id)
          .single();

        if (!jobError && job) {
          jobDetails = {
            jobNumber: job.wo_no,
            customer: customerName.trim(),
            description: jobDescription || job.reference || 'Production Job'
          };
        }
      }

      // Fallback if we couldn't get job details
      if (!jobDetails) {
        jobDetails = {
          jobNumber: 'Unknown',
          customer: customerName.trim(),
          description: jobDescription || 'Job Details'
        };
      }

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
          client_email: customerEmail.trim(),
          client_name: customerName.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', stageInstanceId);

      toast.success("Proof email sent successfully!");
      onProofSent();
      onClose();
      setCustomerName("");
      setCustomerEmail("");
      setJobDescription("");
    } catch (error) {
      console.error("Error sending proof:", error);
      toast.error("Failed to send proof");
    } finally {
      setIsUploading(false);
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
            <Label htmlFor="name">Customer Name *</Label>
            <Input
              id="name"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer Name"
              required
            />
          </div>

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
            <Label htmlFor="proof-pdf">Proof PDF *</Label>
            <div className="mt-1">
              <Input
                id="proof-pdf"
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              {fileInfo && (
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                  <FileText className="h-4 w-4" />
                  <span>{fileInfo.name} ({fileInfo.sizeInKB} KB)</span>
                </div>
              )}
            </div>
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
              disabled={isSending || isUploading || !customerEmail.trim() || !customerName.trim() || !selectedFile}
              className="flex-1"
            >
              <Mail className="h-4 w-4 mr-2" />
              {isSending ? 'Sending...' : isUploading ? 'Uploading...' : 'Send Proof Email'}
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
