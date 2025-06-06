import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ProofUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  stageInstanceId: string;
  onProofSent?: () => void;
}

const ProofUploadDialog: React.FC<ProofUploadDialogProps> = ({
  isOpen,
  onClose,
  stageInstanceId,
  onProofSent
}) => {
  const { user } = useAuth();
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setProofFile(file);
      toast.success(`PDF selected: ${file.name}`);
    } else {
      toast.error('Please select a PDF file');
    }
  };

  const handleUploadAndSend = async () => {
    if (!proofFile || !clientName.trim() || !clientEmail.trim()) {
      toast.error('Please fill in all fields and select a PDF file');
      return;
    }

    if (!user) {
      toast.error('You must be logged in to upload proofs');
      return;
    }

    setIsUploading(true);
    try {
      // Create a unique filename with user folder structure
      const fileName = `${user.id}/proof_${stageInstanceId}_${Date.now()}.pdf`;
      
      console.log('Uploading proof PDF to bucket: proofs, path:', fileName);
      
      // Note: This will create the bucket automatically if it doesn't exist
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('proofs')
        .upload(fileName, proofFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error(`Failed to upload proof PDF: ${uploadError.message}`);
        return;
      }

      console.log('File uploaded successfully:', uploadData);

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('proofs')
        .getPublicUrl(fileName);

      console.log('Public URL generated:', publicUrl);

      // Update the stage instance with client details and proof URL
      const { error: updateError } = await supabase
        .from('job_stage_instances')
        .update({
          client_name: clientName.trim(),
          client_email: clientEmail.trim(),
          proof_pdf_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', stageInstanceId);

      if (updateError) {
        console.error('Update error:', updateError);
        toast.error('Failed to save client details');
        return;
      }

      console.log('Stage instance updated with proof details');
      
      setIsUploading(false);
      setIsSending(true);

      // Generate and send proof link via edge function
      const { data, error } = await supabase.functions.invoke('handle-proof-approval/generate-link', {
        body: { stageInstanceId }
      });

      if (error) {
        console.error('Failed to generate proof link:', error);
        toast.error('Failed to send proof to client');
        return;
      }

      console.log('Proof link generated and sent:', data);
      toast.success(`Proof sent successfully to ${clientEmail}`);
      onProofSent?.();
      onClose();
      
      // Reset form
      setClientName("");
      setClientEmail("");
      setProofFile(null);
    } catch (error) {
      console.error('Error in upload and send process:', error);
      toast.error('Failed to upload and send proof');
    } finally {
      setIsUploading(false);
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Upload className="h-5 w-5 mr-2 text-blue-600" />
            Upload & Send Proof
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="client-name">Client Name</Label>
            <Input
              id="client-name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Enter client name"
            />
          </div>

          <div>
            <Label htmlFor="client-email">Client Email</Label>
            <Input
              id="client-email"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="Enter client email"
            />
          </div>

          <div>
            <Label htmlFor="proof-file">Proof PDF</Label>
            <Input
              id="proof-file"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
            />
            {proofFile && (
              <p className="text-sm text-green-600 mt-1">
                Selected: {proofFile.name}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleUploadAndSend}
              disabled={isUploading || isSending || !proofFile || !clientName.trim() || !clientEmail.trim()}
              className="flex-1"
            >
              {isUploading ? (
                <>
                  <div className="animate-spin h-4 w-4 mr-2 border-2 border-b-transparent border-white rounded-full"></div>
                  Uploading...
                </>
              ) : isSending ? (
                <>
                  <div className="animate-spin h-4 w-4 mr-2 border-2 border-b-transparent border-white rounded-full"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Upload & Send
                </>
              )}
            </Button>
            
            <Button onClick={onClose} variant="outline">
              Cancel
            </Button>
          </div>

          <div className="text-xs text-gray-500">
            This will upload the PDF and send a secure review link to the client's email.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProofUploadDialog;
