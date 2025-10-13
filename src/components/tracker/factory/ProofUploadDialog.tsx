
import React, { useState, useEffect } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Mail, FileText, RefreshCw, CheckCircle, AlertTriangle, Clock, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useFileUpload } from "@/hooks/useFileUpload";
import { formatDistanceToNow } from "date-fns";

interface ProofUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  stageInstanceId: string;
  onProofSent: () => void;
}

interface StageInstanceData {
  client_email: string | null;
  client_name: string | null;
  proof_pdf_url: string | null;
  status: string;
  notes: string | null;
  rework_count: number;
}

interface ProofLinkData {
  id: string;
  token: string;
  created_at: string;
  expires_at: string;
  email_sent_at: string | null;
  resend_count: number;
  client_response: string | null;
  responded_at: string | null;
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
  const [isResending, setIsResending] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [proofLink, setProofLink] = useState<ProofLinkData | null>(null);
  const [existingPdfUrl, setExistingPdfUrl] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [stageData, setStageData] = useState<StageInstanceData | null>(null);

  const { selectedFile, handleFileChange, fileInfo } = useFileUpload({
    acceptedTypes: ["application/pdf"],
    maxSizeInMB: 10
  });

  // Load existing proof data when dialog opens
  useEffect(() => {
    if (isOpen && stageInstanceId) {
      loadProofData();
    }
  }, [isOpen, stageInstanceId]);

  const loadProofData = async () => {
    try {
      // Get stage instance data with status and notes for revision detection
      const { data: stageInstanceData } = await supabase
        .from('job_stage_instances')
        .select('client_email, client_name, proof_pdf_url, status, notes, rework_count')
        .eq('id', stageInstanceId)
        .single();

      if (stageInstanceData) {
        setStageData(stageInstanceData);
        setCustomerEmail(stageInstanceData.client_email || '');
        setCustomerName(stageInstanceData.client_name || '');
        setExistingPdfUrl(stageInstanceData.proof_pdf_url);
      }

      // Get existing proof link if any
      const { data: linkData } = await supabase
        .from('proof_links')
        .select('*')
        .eq('stage_instance_id', stageInstanceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (linkData) {
        setProofLink(linkData);
      }
    } catch (error) {
      console.error('Error loading proof data:', error);
    }
  };

  const handleResendEmail = async () => {
    if (!proofLink) return;

    // Validation: prevent resending within 5 minutes
    if (proofLink.email_sent_at) {
      const lastSentTime = new Date(proofLink.email_sent_at).getTime();
      const now = Date.now();
      const minutesSinceLastSend = (now - lastSentTime) / 1000 / 60;

      if (minutesSinceLastSend < 5) {
        toast.error(`Please wait ${Math.ceil(5 - minutesSinceLastSend)} more minute(s) before resending`);
        return;
      }
    }

    setIsResending(true);
    try {
      const { error } = await supabase.functions.invoke(
        'handle-proof-approval/resend-email',
        { body: { proofLinkId: proofLink.id } }
      );

      if (error) {
        console.error('Failed to resend email:', error);
        toast.error('Failed to resend email');
        return;
      }

      toast.success('Email resent successfully!');
      await loadProofData(); // Refresh proof link data
    } catch (error) {
      console.error('Error resending email:', error);
      toast.error('Failed to resend email');
    } finally {
      setIsResending(false);
    }
  };

  const handleRegenerateLink = async () => {
    if (!confirm('This will invalidate the old proof link and create a new one. Are you sure?')) {
      return;
    }

    setIsRegenerating(true);
    try {
      const { error } = await supabase.functions.invoke(
        'handle-proof-approval/regenerate-link',
        { body: { stageInstanceId } }
      );

      if (error) {
        console.error('Failed to regenerate link:', error);
        toast.error('Failed to regenerate link');
        return;
      }

      toast.success('New proof link generated and sent!');
      await loadProofData(); // Refresh proof link data
    } catch (error) {
      console.error('Error regenerating link:', error);
      toast.error('Failed to regenerate link');
    } finally {
      setIsRegenerating(false);
    }
  };

  const uploadProofPdf = async (file: File): Promise<string | null> => {
    try {
      // Add version number to filename if this is a revision
      const versionSuffix = stageData?.rework_count ? `_v${stageData.rework_count + 1}` : '';
      const fileName = `proof_${stageInstanceId}${versionSuffix}_${Date.now()}.pdf`;
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

    if (!selectedFile && !existingPdfUrl) {
      toast.error("Please upload a proof PDF");
      return;
    }

    // Warn if changing email after already sent
    if (proofLink && proofLink.email_sent_at) {
      const { data: stageData } = await supabase
        .from('job_stage_instances')
        .select('client_email')
        .eq('id', stageInstanceId)
        .single();
      
      if (stageData && stageData.client_email && customerEmail !== stageData.client_email) {
        if (!confirm(`You're changing the email from ${stageData.client_email}. The old link will still work. Continue?`)) {
          return;
        }
      }
    }

    setIsUploading(true);
    setIsSending(true);
    
    try {
      let proofPdfUrl = existingPdfUrl;

      // Upload new PDF if one was selected
      if (selectedFile) {
        proofPdfUrl = await uploadProofPdf(selectedFile);
        if (!proofPdfUrl) {
          toast.error("Failed to upload proof PDF");
          return;
        }
      }

      // Prepare update data - increment rework_count if this is a revision
      const isRevision = stageData?.status === 'changes_requested';
      const updateData: any = { 
        proof_pdf_url: proofPdfUrl,
        client_email: customerEmail.trim(),
        client_name: customerName.trim(),
        proof_emailed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // If this is a revision, increment rework_count and append revision log to notes
      if (isRevision) {
        const currentReworkCount = stageData?.rework_count || 0;
        const newReworkCount = currentReworkCount + 1;
        updateData.rework_count = newReworkCount;
        
        // Append revision log to existing notes
        const revisionLog = `\n\nREVISION #${newReworkCount} (${new Date().toISOString().split('T')[0]}): Revised proof uploaded and sent to client`;
        updateData.notes = (stageData?.notes || '') + revisionLog;
        
        console.log(`🔄 Uploading revision #${newReworkCount} for stage ${stageInstanceId}`);
      }

      // Update stage instance
      await supabase
        .from('job_stage_instances')
        .update(updateData)
        .eq('id', stageInstanceId);

      // Generate proof link - this will send the email automatically
      console.log('📤 Generating proof link and sending email...');
      const { data: linkData, error: linkError } = await supabase.functions.invoke(
        'handle-proof-approval/generate-link',
        { body: { stageInstanceId } }
      );

      if (linkError || !linkData) {
        console.error('❌ Failed to generate proof link:', linkError);
        toast.error("Failed to generate proof link and send email");
        return;
      }

      console.log('✅ Proof link generated:', linkData.proofUrl);
      
      if (isRevision) {
        toast.success(`Revised proof (v${(stageData?.rework_count || 0) + 1}) sent to client!`);
      } else {
        toast.success("Proof link generated and email sent!");
      }
      
      setHasUnsavedChanges(false);
      await loadProofData(); // Refresh to show new proof link data
      onProofSent();
    } catch (error) {
      console.error("Error sending proof:", error);
      toast.error("Failed to send proof");
    } finally {
      setIsUploading(false);
      setIsSending(false);
    }
  };

  const getProofStatusInfo = () => {
    if (!proofLink) return null;

    const expiresAt = new Date(proofLink.expires_at);
    const now = new Date();
    const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / 1000 / 60 / 60;
    const isExpiringSoon = hoursUntilExpiry < 24 && hoursUntilExpiry > 0;
    const isExpired = hoursUntilExpiry <= 0;

    return {
      emailSentAt: proofLink.email_sent_at,
      resendCount: proofLink.resend_count || 0,
      clientResponse: proofLink.client_response,
      respondedAt: proofLink.responded_at,
      expiresAt,
      isExpiringSoon,
      isExpired,
      hoursUntilExpiry
    };
  };

  const statusInfo = getProofStatusInfo();
  const isRevisionMode = stageData?.status === 'changes_requested';
  const parsedFeedback = stageData?.notes?.replace(/^CLIENT FEEDBACK:\s*/i, '').split('\n')[0]?.trim();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {isRevisionMode 
              ? `Upload Revised Proof (Revision #${(stageData?.rework_count || 0) + 1})` 
              : proofLink ? 'Manage Proof' : 'Send Proof to Client'
            }
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client Change Request Alert - Show when responding to changes */}
          {isRevisionMode && parsedFeedback && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription>
                <p className="font-medium text-orange-800 mb-1">Client's Requested Changes:</p>
                <p className="text-sm text-orange-700 italic">"{parsedFeedback}"</p>
                <p className="text-xs text-orange-600 mt-2">
                  Please address the above feedback in your revised proof before uploading.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Proof Status Card */}
          {statusInfo && (
            <Alert className={
              statusInfo.clientResponse === 'approved' ? 'border-green-200 bg-green-50' :
              statusInfo.clientResponse === 'changes_needed' ? 'border-orange-200 bg-orange-50' :
              statusInfo.isExpired ? 'border-red-200 bg-red-50' :
              statusInfo.isExpiringSoon ? 'border-yellow-200 bg-yellow-50' :
              'border-blue-200 bg-blue-50'
            }>
              <AlertDescription className="space-y-2">
                <div className="flex items-start gap-2">
                  {statusInfo.clientResponse === 'approved' ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : statusInfo.clientResponse === 'changes_needed' ? (
                    <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                  ) : statusInfo.isExpired ? (
                    <Clock className="h-5 w-5 text-red-600 mt-0.5" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">
                      {statusInfo.clientResponse === 'approved' ? '✅ Proof Approved by Client' :
                       statusInfo.clientResponse === 'changes_needed' ? '⚠️ Client Requested Changes' :
                       statusInfo.isExpired ? '❌ Proof Link Expired' :
                       `✉️ Proof Sent to ${customerEmail}`}
                    </p>
                    <div className="text-sm space-y-1 mt-1">
                      {statusInfo.emailSentAt && (
                        <p>📧 Last sent: {formatDistanceToNow(new Date(statusInfo.emailSentAt), { addSuffix: true })}</p>
                      )}
                      {statusInfo.resendCount > 0 && (
                        <p>🔄 Resent {statusInfo.resendCount} time(s)</p>
                      )}
                      {statusInfo.respondedAt && (
                        <p>📝 Client responded: {formatDistanceToNow(new Date(statusInfo.respondedAt), { addSuffix: true })}</p>
                      )}
                      {!statusInfo.isExpired && (
                        <p className={statusInfo.isExpiringSoon ? 'text-orange-600 font-medium' : ''}>
                          ⏰ Expires {formatDistanceToNow(statusInfo.expiresAt, { addSuffix: true })}
                          {statusInfo.isExpiringSoon && ' - Consider regenerating soon'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Form Fields */}
          <div>
            <Label htmlFor="name">Customer Name *</Label>
            <Input
              id="name"
              type="text"
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                setHasUnsavedChanges(true);
              }}
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
              onChange={(e) => {
                setCustomerEmail(e.target.value);
                setHasUnsavedChanges(true);
              }}
              placeholder="customer@example.com"
              required
            />
          </div>

          <div>
            <Label htmlFor="proof-pdf">
              Proof PDF * {existingPdfUrl && '(Current PDF uploaded)'}
            </Label>
            <div className="mt-1">
              <Input
                id="proof-pdf"
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  handleFileChange(e);
                  setHasUnsavedChanges(true);
                }}
                className="cursor-pointer"
              />
              {fileInfo && (
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                  <FileText className="h-4 w-4" />
                  <span>{fileInfo.name} ({fileInfo.sizeInKB} KB)</span>
                </div>
              )}
              {existingPdfUrl && !selectedFile && (
                <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>PDF already uploaded - select new file to replace</span>
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

          {/* Action Buttons */}
          <div className="space-y-2">
            {proofLink ? (
              // Existing proof - show resend/regenerate options
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={handleResendEmail}
                    disabled={isResending || !statusInfo?.emailSentAt}
                    variant="outline"
                    className="w-full"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isResending ? 'Resending...' : 'Resend Email'}
                  </Button>
                  <Button
                    onClick={handleRegenerateLink}
                    disabled={isRegenerating}
                    variant="outline"
                    className="w-full"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {isRegenerating ? 'Regenerating...' : 'Regenerate Link'}
                  </Button>
                </div>
                {hasUnsavedChanges && (
                  <Button
                    onClick={handleSendProof}
                    disabled={isSending || isUploading || !customerEmail.trim() || !customerName.trim()}
                    className="w-full"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {isSending ? 'Saving & Sending...' : 'Save Changes & Send New Email'}
                  </Button>
                )}
              </>
            ) : (
              // New proof - show send button
              <Button
                onClick={handleSendProof}
                disabled={isSending || isUploading || !customerEmail.trim() || !customerName.trim() || (!selectedFile && !existingPdfUrl)}
                className="w-full"
              >
                <Mail className="h-4 w-4 mr-2" />
                {isSending ? 'Sending...' : isUploading ? 'Uploading...' : 'Send Proof Email'}
              </Button>
            )}
            
            <Button variant="outline" onClick={onClose} className="w-full">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProofUploadDialog;
