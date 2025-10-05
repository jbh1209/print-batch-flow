import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, Mail, ThumbsUp, Package, Printer, ArrowRight, Scan, Copy, Link as LinkIcon, FileText } from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { BatchCategorySelector } from "../../batch-allocation/BatchCategorySelector";
import { BatchJobFormRHF } from "../../batch-allocation/BatchJobFormRHF";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useStageActions } from "@/hooks/tracker/stage-management/useStageActions";
import { useProofApprovalFlow } from "@/hooks/tracker/useProofApprovalFlow";
import { useProofLinks } from "@/hooks/useProofLinks";
import { useFileUpload } from "@/hooks/useFileUpload";
import { HP12000PaperSizeSelector } from "./HP12000PaperSizeSelector";
import { useState } from "react";

interface StageInstance {
  id: string;
  status: string;
  proof_emailed_at?: string;
  proof_approved_manually_at?: string;
  client_email?: string;
  client_name?: string;
}

type ProofApprovalFlow = 'pending' | 'choosing_allocation' | 'batch_allocation' | 'direct_printing';

interface ProofStageActionsProps {
  job: AccessibleJob;
  stageStatus: string;
  stageInstance: StageInstance | null;
  proofApprovalFlow: ProofApprovalFlow;
  selectedBatchCategory: string;
  scanCompleted: boolean;
  isLoading: boolean;
  onRefresh?: () => void;
  onClose: () => void;
  onProofApprovalFlowChange: (flow: ProofApprovalFlow) => void;
  onBatchCategoryChange: (category: string) => void;
  setStageInstance: (instance: StageInstance | null) => void;
}

export const ProofStageActions: React.FC<ProofStageActionsProps> = ({
  job,
  stageStatus,
  stageInstance,
  proofApprovalFlow,
  selectedBatchCategory,
  scanCompleted,
  isLoading,
  onRefresh,
  onClose,
  onProofApprovalFlowChange,
  onBatchCategoryChange,
  setStageInstance
}) => {
  const { user } = useAuth();
  const { startStage, completeStage, completeStageAndSkipConditional, isProcessing } = useStageActions();
  const { completeProofStage } = useProofApprovalFlow();
  const { generateProofLink, isGenerating } = useProofLinks();
  const [generatedProofLink, setGeneratedProofLink] = useState<string | null>(null);
  const [hp12000ValidationStatus, setHP12000ValidationStatus] = useState<{
    isValid: boolean;
    message?: string;
  }>({ isValid: true });
  
  // Client details state
  const [clientEmail, setClientEmail] = useState(stageInstance?.client_email || '');
  const [clientName, setClientName] = useState(stageInstance?.client_name || '');
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  
  // File upload for proof PDF
  const { 
    selectedFile: proofPdfFile, 
    handleFileChange: handleProofPdfChange,
    clearSelectedFile: clearProofPdf,
    fileInfo: proofPdfInfo
  } = useFileUpload({
    acceptedTypes: ['application/pdf'],
    maxSizeInMB: 10
  });

  // Get the current stage instance ID from the job stage instances
  const getCurrentStageInstanceId = async (): Promise<string | null> => {
    if (stageInstance?.id) {
      return stageInstance.id;
    }

    // Fallback: query for the current active proof stage instance
    const { data, error } = await supabase
      .from('job_stage_instances')
      .select('id')
      .eq('job_id', job.job_id)
      .eq('job_table_name', 'production_jobs')
      .eq('production_stage_id', job.current_stage_id)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      console.error('❌ Could not find current stage instance:', error);
      return null;
    }

    return data.id;
  };

  const handleStartProof = async () => {
    const stageInstanceId = await getCurrentStageInstanceId();
    if (!stageInstanceId) {
      toast.error("No current stage instance found");
      return;
    }

    try {
      const success = await startStage(stageInstanceId);
      
      if (success) {
        const { error: jobError } = await supabase
          .from('production_jobs')
          .update({
            status: 'Proof In Progress',
            updated_at: new Date().toISOString()
          })
          .eq('id', job.job_id);

        if (jobError) throw jobError;

        toast.success("Proof stage started");
        onRefresh?.();
      }
    } catch (error) {
      console.error('Error starting proof:', error);
      toast.error("Failed to start proof stage");
    }
  };

  const handleGenerateProofLink = async () => {
    if (!stageInstance?.id) {
      toast.error("No stage instance found");
      return;
    }

    // Validate inputs
    if (!proofPdfFile) {
      toast.error("Please upload a proof PDF first");
      return;
    }

    if (!clientEmail || !clientEmail.includes('@')) {
      toast.error("Please enter a valid client email");
      return;
    }

    setIsUploadingPdf(true);

    try {
      // Upload PDF to storage
      const fileExt = proofPdfFile.name.split('.').pop();
      const fileName = `${job.job_id}_${stageInstance.id}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('proof-pdfs')
        .upload(filePath, proofPdfFile);

      if (uploadError) {
        console.error('PDF upload error:', uploadError);
        toast.error('Failed to upload proof PDF');
        return;
      }

      // Get public URL for the PDF
      const { data: { publicUrl } } = supabase.storage
        .from('proof-pdfs')
        .getPublicUrl(filePath);

      console.log('✅ Proof PDF uploaded:', publicUrl);

      // Update stage instance with PDF URL and client details
      const { error: updateError } = await supabase
        .from('job_stage_instances')
        .update({
          proof_pdf_url: publicUrl,
          client_email: clientEmail,
          client_name: clientName || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', stageInstance.id);

      if (updateError) {
        console.error('Error updating stage instance:', updateError);
        toast.error('Failed to save proof details');
        return;
      }

      // Also update production job with client details for future reference
      const { error: jobUpdateError } = await supabase
        .from('production_jobs')
        .update({
          client_email: clientEmail,
          client_name: clientName || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.job_id);

      if (jobUpdateError) {
        console.error('Error updating job with client details:', jobUpdateError);
      }

      // Generate proof link (this will trigger email sending)
      const link = await generateProofLink(stageInstance.id);
      if (link) {
        setGeneratedProofLink(link);
        clearProofPdf();
      }
    } catch (error) {
      console.error('Error in proof generation:', error);
      toast.error('Failed to generate proof link');
    } finally {
      setIsUploadingPdf(false);
    }
  };

  const handleCopyLink = async () => {
    if (generatedProofLink) {
      await navigator.clipboard.writeText(generatedProofLink);
      toast.success("Link copied to clipboard");
    }
  };

  const handleProofEmailed = async () => {
    const currentTime = new Date().toISOString();

    try {
      const { error: proofError } = await supabase
        .from('job_stage_instances')
        .update({
          proof_emailed_at: currentTime,
          updated_at: currentTime
        })
        .eq('job_id', job.job_id)
        .eq('production_stage_id', job.current_stage_id);

      if (proofError) throw proofError;

      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({
          status: 'Awaiting Client Sign Off',
          updated_at: currentTime
        })
        .eq('id', job.job_id);

      if (jobError) throw jobError;

      toast.success("Proof marked as emailed");
      setGeneratedProofLink(null); // Reset link state
      onRefresh?.();
    } catch (error) {
      console.error('Error marking proof as emailed:', error);
      toast.error("Failed to mark proof as emailed");
    }
  };

  const handleProofApproved = async () => {
    // Check HP12000 paper size validation before proceeding
    if (!hp12000ValidationStatus.isValid) {
      toast.error(hp12000ValidationStatus.message || 'Please assign paper sizes to all HP12000 stages before approving proof');
      return;
    }

    try {
      console.log(`🎯 Starting proof approval for job ${job.job_id}`);
      
      if (!stageInstance?.id) {
        toast.error('No stage instance found');
        return;
      }

      // Use the existing proof approval flow hook
      const success = await completeProofStage(job.job_id, stageInstance.id);

      if (!success) {
        toast.error('Failed to approve proof');
        return;
      }

      console.log('✅ Proof approved and scheduling triggered');
      
      // CRITICAL: Update local stageInstance immediately to prevent loadModalData race condition
      if (stageInstance) {
        const currentTime = new Date().toISOString();
        setStageInstance({
          ...stageInstance,
          proof_approved_manually_at: currentTime
        });
      }
      
      // IMMEDIATE STATE UPDATE for instant UI feedback
      onProofApprovalFlowChange('choosing_allocation');
      toast.success('Proof approved! Scheduling triggered. Choose next step.');
      
      // Delayed refresh to ensure database consistency 
      setTimeout(() => {
        onRefresh?.();
      }, 100);
      
    } catch (error) {
      console.error('Error marking proof as approved:', error);
      toast.error('Failed to mark proof as approved');
    }
  };

  const handleSendToBatchAllocation = async () => {
    const currentStageInstanceId = await getCurrentStageInstanceId();
    if (!currentStageInstanceId) {
      toast.error("No current stage instance found");
      return;
    }

    try {
      console.log('🔄 Completing proof stage and sending to batch allocation');
      
      // Complete the current proof stage using the stage instance ID
      const success = await completeStage(
        currentStageInstanceId,
        'Proof approved - sending to batch allocation'
      );

      if (!success) {
        throw new Error('Failed to complete proof stage');
      }

      // Update job status to indicate batch processing
      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({
          status: 'Batch Allocation',
          batch_category: selectedBatchCategory,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.job_id);

      if (jobError) throw jobError;

      toast.success("Job sent to batch allocation successfully");
      onRefresh?.();
      onClose();
    } catch (error) {
      console.error('❌ Error sending to batch allocation:', error);
      toast.error("Failed to send job to batch allocation");
    }
  };

  const handleAdvanceToPrintingStage = async () => {
    const currentStageInstanceId = await getCurrentStageInstanceId();
    if (!currentStageInstanceId) {
      toast.error("No current stage instance found");
      return;
    }

    try {
      console.log('🔄 Completing proof stage and advancing to printing (skipping conditional stages)');
      
      // Complete the current proof stage and skip conditional stages using the correct stage instance ID
      const success = await completeStageAndSkipConditional(
        job.job_id,
        currentStageInstanceId,
        'Proof approved - advancing directly to printing'
      );

      if (!success) {
        throw new Error('Failed to complete proof stage and advance');
      }

      // Update job status to Ready to Print
      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({
          status: 'Ready to Print',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.job_id);

      if (jobError) throw jobError;

      toast.success("Job advanced to printing stage");
      onRefresh?.();
      onClose();
    } catch (error) {
      console.error('❌ Error advancing to printing stage:', error);
      toast.error("Failed to advance to printing stage");
    }
  };

  const handleBatchJobCreated = async () => {
    // When batch job is created, we need to advance the main production job
    await handleSendToBatchAllocation();
  };

  const hasProofBeenEmailed = stageInstance?.proof_emailed_at;
  const hasProofBeenApproved = stageInstance?.proof_approved_manually_at;

  if (stageStatus === 'pending') {
    return (
      <div className="space-y-3">
        <Button 
          onClick={handleStartProof}
          disabled={!scanCompleted || isLoading || isProcessing}
          className={`w-full ${scanCompleted ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'}`}
        >
          <Play className="h-4 w-4 mr-2" />
          {scanCompleted ? "Start Proof Process" : "Scan Required First"}
        </Button>
      </div>
    );
  }

  if (stageStatus === 'active') {
    if (!hasProofBeenEmailed) {
      return (
        <div className="space-y-4">
          {!generatedProofLink ? (
            <>
              {/* PDF Upload Section */}
              <div className="space-y-2">
                <Label htmlFor="proof-pdf" className="text-sm font-medium">
                  Upload Proof PDF *
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="proof-pdf"
                    type="file"
                    accept="application/pdf"
                    onChange={handleProofPdfChange}
                    className="flex-1"
                  />
                </div>
                {proofPdfInfo && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>{proofPdfInfo.name} ({(proofPdfInfo.sizeInKB / 1024).toFixed(2)} MB)</span>
                  </div>
                )}
              </div>

              {/* Client Email Input */}
              <div className="space-y-2">
                <Label htmlFor="client-email" className="text-sm font-medium">
                  Client Email *
                </Label>
                <Input
                  id="client-email"
                  type="email"
                  placeholder="client@example.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  required
                />
              </div>

              {/* Client Name Input */}
              <div className="space-y-2">
                <Label htmlFor="client-name" className="text-sm font-medium">
                  Client Name (Optional)
                </Label>
                <Input
                  id="client-name"
                  type="text"
                  placeholder="John Doe"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>

              {/* Generate Link Button */}
              <Button 
                onClick={handleGenerateProofLink}
                disabled={
                  isLoading || 
                  isProcessing || 
                  isGenerating || 
                  isUploadingPdf || 
                  !proofPdfFile || 
                  !clientEmail
                }
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <LinkIcon className="h-4 w-4 mr-2" />
                {isUploadingPdf ? 'Uploading PDF...' : isGenerating ? 'Generating Link...' : 'Generate Proof Link'}
              </Button>
            </>
          ) : (
            <>
              {/* Generated Link Display */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-green-700">
                  ✅ Proof Link Generated (Email Sent)
                </Label>
                <div className="flex gap-2">
                  <Input 
                    value={generatedProofLink}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    onClick={handleCopyLink}
                    variant="outline"
                    size="icon"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Mark as Emailed Button */}
              <Button 
                onClick={handleProofEmailed}
                disabled={isLoading || isProcessing}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Mail className="h-4 w-4 mr-2" />
                Mark as Emailed
              </Button>
            </>
          )}
        </div>
      );
    }

    if (hasProofBeenEmailed && !hasProofBeenApproved) {
      return (
        <div className="space-y-3">
          {/* HP12000 Paper Size Selector */}
          <HP12000PaperSizeSelector 
            jobId={job.job_id}
            onValidationChange={(isValid, message) => setHP12000ValidationStatus({ isValid, message })}
          />
          
          <div className="flex items-center justify-center gap-2 text-blue-600 bg-blue-50 p-3 rounded-md">
            <Mail className="h-4 w-4" />
            <span className="text-sm font-medium">Proof Emailed - Awaiting Client Response</span>
          </div>
          
          <div className="text-xs text-gray-500 text-center">
            Emailed: {new Date(hasProofBeenEmailed).toLocaleDateString()} at {new Date(hasProofBeenEmailed).toLocaleTimeString()}
          </div>

          <Button 
            onClick={handleProofApproved}
            disabled={isLoading || isProcessing || !hp12000ValidationStatus.isValid}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            <ThumbsUp className="h-4 w-4 mr-2" />
            {hp12000ValidationStatus.isValid ? 'Mark as Approved' : 'HP12000 Paper Sizes Required'}
          </Button>
        </div>
      );
    }

    if (hasProofBeenApproved) {
      if (proofApprovalFlow === 'choosing_allocation') {
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-green-600 bg-green-50 p-3 rounded-md">
              <ThumbsUp className="h-4 w-4" />
              <span className="text-sm font-medium">Proof Approved - Choose Next Step</span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Button 
                onClick={() => onProofApprovalFlowChange('batch_allocation')}
                disabled={isLoading || isProcessing}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                <Package className="h-4 w-4 mr-2" />
                Send to Batch Processing
              </Button>
              
              <Button 
                onClick={handleAdvanceToPrintingStage}
                disabled={isLoading || isProcessing}
                className="w-full bg-blue-600 hover:bg-blue-700"
                variant="outline"
              >
                <Printer className="h-4 w-4 mr-2" />
                {isLoading || isProcessing ? 'Processing...' : 'Send Directly to Printing'}
              </Button>
            </div>
          </div>
        );
      }

      if (proofApprovalFlow === 'batch_allocation') {
        if (!selectedBatchCategory) {
          return (
            <div className="space-y-4">
              <BatchCategorySelector
                onSelectCategory={onBatchCategoryChange}
                selectedCategory={selectedBatchCategory}
                disabled={isLoading || isProcessing}
              />
              <Button 
                onClick={() => onProofApprovalFlowChange('choosing_allocation')}
                variant="outline"
                className="w-full"
                disabled={isProcessing}
              >
                Back to Options
              </Button>
            </div>
          );
        } else {
          return (
            <div className="space-y-4">
              <BatchJobFormRHF
                wo_no={job.wo_no}
                customer={job.customer || ''}
                qty={job.qty || 1}
                due_date={job.due_date ? new Date(job.due_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                batchCategory={selectedBatchCategory}
                onJobCreated={handleBatchJobCreated}
                onCancel={() => onProofApprovalFlowChange('choosing_allocation')}
              />
            </div>
          );
        }
      }
    }
  }

  return null;
};
