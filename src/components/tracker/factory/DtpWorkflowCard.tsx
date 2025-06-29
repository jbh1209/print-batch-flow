
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePartPrintingAssignment } from "@/hooks/tracker/usePartPrintingAssignment";
import { DtpWorkflowActions } from "./dtp/DtpWorkflowActions";

interface DtpWorkflowCardProps {
  job: AccessibleJob;
  onRefresh: () => void;
}

interface PrintingStage {
  id: string;
  name: string;
  color: string;
}

export const DtpWorkflowCard: React.FC<DtpWorkflowCardProps> = ({
  job,
  onRefresh
}) => {
  const { user } = useAuth();
  const [selectedPrintingStage, setSelectedPrintingStage] = useState<string>("");
  const [printingStages, setPrintingStages] = useState<PrintingStage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [jobParts, setJobParts] = useState<string[]>([]);
  const [partAssignments, setPartAssignments] = useState<Record<string, string>>({});
  const [showPartSelector, setShowPartSelector] = useState(false);

  const { assignPartsToStages, getJobParts, isAssigning } = usePartPrintingAssignment();

  // Load printing stages and job parts when component mounts
  React.useEffect(() => {
    const loadData = async () => {
      const { data } = await supabase
        .from('production_stages')
        .select('id, name, color')
        .ilike('name', '%printing%')
        .eq('is_active', true)
        .order('name');
      
      if (data) {
        setPrintingStages(data);
      }

      // Load job parts if the job has a category
      if (job.category_id) {
        const parts = await getJobParts(job.job_id, job.category_id);
        setJobParts(parts);
        setShowPartSelector(parts.length > 1); // Show part selector if multiple parts
      }
    };
    loadData();
  }, [job.category_id, job.job_id, getJobParts]);

  const getCurrentStage = () => {
    const stageName = job.current_stage_name?.toLowerCase() || '';
    if (stageName.includes('dtp')) return 'dtp';
    if (stageName.includes('proof')) return 'proof';
    if (stageName.includes('batch allocation') || stageName.includes('batch_allocation')) return 'batch_allocation';
    return 'unknown';
  };

  const getStageStatus = () => {
    return job.current_stage_status || 'pending';
  };

  const currentStage = getCurrentStage();
  const stageStatus = getStageStatus();

  const handleStartDTP = async () => {
    setIsLoading(true);
    try {
      const { error: startError } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: user?.id
        })
        .eq('job_id', job.job_id)
        .eq('production_stage_id', job.current_stage_id)
        .eq('status', 'pending');

      if (startError) throw startError;

      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({
          status: 'In Progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.job_id);

      if (jobError) throw jobError;

      toast.success("DTP work started - job marked as In Progress");
      onRefresh();
    } catch (error) {
      console.error('Error starting DTP:', error);
      toast.error("Failed to start DTP work");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteDTP = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.rpc('advance_job_stage', {
        p_job_id: job.job_id,
        p_job_table_name: 'production_jobs',
        p_current_stage_id: job.current_stage_id,
        p_notes: 'DTP work completed'
      });

      if (error) throw error;

      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({
          status: 'Ready for Proof',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.job_id);

      if (jobError) throw jobError;

      toast.success("DTP completed - job moved to Proof stage");
      onRefresh();
    } catch (error) {
      console.error('Error completing DTP:', error);
      toast.error("Failed to complete DTP work");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartProof = async () => {
    setIsLoading(true);
    try {
      const { error: startError } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
          started_by: user?.id
        })
        .eq('job_id', job.job_id)
        .eq('production_stage_id', job.current_stage_id)
        .eq('status', 'pending');

      if (startError) throw startError;

      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({
          status: 'Proof In Progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.job_id);

      if (jobError) throw jobError;

      toast.success("Proof stage started");
      onRefresh();
    } catch (error) {
      console.error('Error starting proof:', error);
      toast.error("Failed to start proof stage");
    } finally {
      setIsLoading(false);
    }
  };

  const handleProofEmailed = async () => {
    setIsLoading(true);
    try {
      const { error: proofError } = await supabase
        .from('job_stage_instances')
        .update({
          proof_emailed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('job_id', job.job_id)
        .eq('production_stage_id', job.current_stage_id);

      if (proofError) throw proofError;

      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({
          status: 'Awaiting Client Sign Off',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.job_id);

      if (jobError) throw jobError;

      toast.success("Proof marked as emailed - awaiting client approval");
      onRefresh();
    } catch (error) {
      console.error('Error marking proof as emailed:', error);
      toast.error("Failed to mark proof as emailed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdvanceToPartSpecificPrinting = async () => {
    if (Object.keys(partAssignments).length !== jobParts.length) {
      toast.error("Please assign all parts to printing stages");
      return;
    }

    const success = await assignPartsToStages(
      job.job_id,
      job.current_stage_id,
      partAssignments,
      'Proof approved - parts assigned to specific printing stages'
    );

    if (success) {
      await supabase
        .from('production_jobs')
        .update({
          status: 'Ready to Print',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.job_id);

      toast.success("Job advanced to part-specific printing stages");
      onRefresh();
    }
  };

  const handleAdvanceToPrintingStage = async () => {
    if (!selectedPrintingStage) {
      toast.error("Please select a printing stage");
      return;
    }

    setIsLoading(true);
    try {
      const { error: completeError } = await supabase.rpc('advance_job_stage', {
        p_job_id: job.job_id,
        p_job_table_name: 'production_jobs',
        p_current_stage_id: job.current_stage_id,
        p_notes: 'Proof approved - advancing to printing'
      });

      if (completeError) throw completeError;

      const { error: insertError } = await supabase
        .from('job_stage_instances')
        .insert({
          job_id: job.job_id,
          job_table_name: 'production_jobs',
          category_id: job.category_id,
          production_stage_id: selectedPrintingStage,
          stage_order: 999,
          status: 'pending'
        });

      if (insertError) throw insertError;

      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({
          status: 'Ready to Print',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.job_id);

      if (jobError) throw jobError;

      const selectedStage = printingStages.find(s => s.id === selectedPrintingStage);
      toast.success(`Job advanced to ${selectedStage?.name || 'printing stage'}`);
      onRefresh();
    } catch (error) {
      console.error('Error advancing to printing stage:', error);
      toast.error("Failed to advance to printing stage");
    } finally {
      setIsLoading(false);
    }
  };

  const currentStage = getCurrentStage();
  const stageStatus = getStageStatus();

  const getStatusBadge = () => {
    const status = job.status;
    let variant: "default" | "secondary" | "destructive" | "outline" = "default";
    let color = "";

    if (status.includes('Progress')) {
      variant = "default";
      color = "bg-blue-100 text-blue-800 border-blue-200";
    } else if (status.includes('Ready')) {
      variant = "secondary";
      color = "bg-green-100 text-green-800 border-green-200";
    } else if (status.includes('Awaiting')) {
      variant = "outline";
      color = "bg-orange-100 text-orange-800 border-orange-200";
    } else if (status.includes('Approved') || status.includes('Allocated')) {
      variant = "secondary";
      color = "bg-green-100 text-green-800 border-green-200";
    }

    return (
      <Badge variant={variant} className={color}>
        {status}
      </Badge>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{job.wo_no}</span>
          {getStatusBadge()}
        </CardTitle>
        <div className="text-sm text-gray-600">
          <p><strong>Customer:</strong> {job.customer}</p>
          <p><strong>Stage:</strong> {job.current_stage_name}</p>
          <p><strong>Due:</strong> {job.due_date ? new Date(job.due_date).toLocaleDateString() : 'Not set'}</p>
          {jobParts.length > 1 && (
            <p><strong>Parts:</strong> {jobParts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(', ')}</p>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <DtpWorkflowActions
          currentStage={currentStage}
          stageStatus={stageStatus}
          isLoading={isLoading}
          showPartSelector={showPartSelector}
          jobParts={jobParts}
          partAssignments={partAssignments}
          printingStages={printingStages}
          selectedPrintingStage={selectedPrintingStage}
          isAssigning={isAssigning}
          job={job}
          onStartDtp={handleStartDTP}
          onCompleteDtp={handleCompleteDTP}
          onStartProof={handleStartProof}
          onProofEmailed={handleProofEmailed}
          onPartAssignmentsChange={setPartAssignments}
          onSelectedPrintingStageChange={setSelectedPrintingStage}
          onAdvanceToPartSpecificPrinting={handleAdvanceToPartSpecificPrinting}
          onAdvanceToPrintingStage={handleAdvanceToPrintingStage}
          onRefresh={onRefresh}
        />
      </CardContent>
    </Card>
  );
};
