import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Play, CheckCircle, Mail, ThumbsUp, ArrowRight } from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

  // Load printing stages when component mounts
  React.useEffect(() => {
    const loadPrintingStages = async () => {
      const { data } = await supabase
        .from('production_stages')
        .select('id, name, color')
        .ilike('name', '%printing%')
        .eq('is_active', true)
        .order('name');
      
      if (data) {
        setPrintingStages(data);
      }
    };
    loadPrintingStages();
  }, []);

  const getCurrentStage = () => {
    const stageName = job.current_stage_name?.toLowerCase() || '';
    if (stageName.includes('dtp')) return 'dtp';
    if (stageName.includes('proof')) return 'proof';
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
      // Start the DTP stage
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

      // Update job status to "In Progress"
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
      // Complete current stage using the advance function
      const { error } = await supabase.rpc('advance_job_stage', {
        p_job_id: job.job_id,
        p_job_table_name: 'production_jobs',
        p_current_stage_id: job.current_stage_id,
        p_notes: 'DTP work completed'
      });

      if (error) throw error;

      // Update job status to "Ready for Proof"
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
      // Start the proof stage
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

      // Update job status
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
      // Mark proof as emailed
      const { error: proofError } = await supabase
        .from('job_stage_instances')
        .update({
          proof_emailed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('job_id', job.job_id)
        .eq('production_stage_id', job.current_stage_id);

      if (proofError) throw proofError;

      // Update job status
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

  const handleAdvanceToPrintingStage = async () => {
    if (!selectedPrintingStage) {
      toast.error("Please select a printing stage");
      return;
    }

    setIsLoading(true);
    try {
      // First complete the current proof stage
      const { error: completeError } = await supabase.rpc('advance_job_stage', {
        p_job_id: job.job_id,
        p_job_table_name: 'production_jobs',
        p_current_stage_id: job.current_stage_id,
        p_notes: 'Proof approved - advancing to printing'
      });

      if (completeError) throw completeError;

      // Create new stage instance for the selected printing stage
      const { error: insertError } = await supabase
        .from('job_stage_instances')
        .insert({
          job_id: job.job_id,
          job_table_name: 'production_jobs',
          category_id: job.category_id,
          production_stage_id: selectedPrintingStage,
          stage_order: 999, // High number to put it at the end
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

  const renderProofActions = () => {
    if (stageStatus === 'pending') {
      return (
        <Button 
          onClick={handleStartProof}
          disabled={isLoading}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          <Play className="h-4 w-4 mr-2" />
          Start Proof Process
        </Button>
      );
    }

    if (stageStatus === 'active') {
      return (
        <div className="space-y-3">
          <Button 
            onClick={handleProofEmailed}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <Mail className="h-4 w-4 mr-2" />
            Proof Emailed
          </Button>
          
          {/* Printing Stage Selection */}
          <div className="space-y-2">
            <Label>Select Printing Stage:</Label>
            <div className="flex gap-2">
              <Select value={selectedPrintingStage} onValueChange={setSelectedPrintingStage}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Choose printing stage..." />
                </SelectTrigger>
                <SelectContent>
                  {printingStages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleAdvanceToPrintingStage}
                disabled={!selectedPrintingStage || isLoading}
                size="sm"
              >
                <ArrowRight className="h-4 w-4 mr-1" />
                Advance
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderDTPActions = () => {
    if (stageStatus === 'pending') {
      return (
        <Button 
          onClick={handleStartDTP}
          disabled={isLoading}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          <Play className="h-4 w-4 mr-2" />
          Start DTP Work
        </Button>
      );
    }

    if (stageStatus === 'active') {
      return (
        <Button 
          onClick={handleCompleteDTP}
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Complete DTP
        </Button>
      );
    }

    return null;
  };

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
    } else if (status.includes('Approved')) {
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
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {currentStage === 'dtp' && renderDTPActions()}
        {currentStage === 'proof' && renderProofActions()}
        
        {currentStage === 'unknown' && (
          <div className="text-center text-gray-500">
            Stage not recognized or no actions available
          </div>
        )}
      </CardContent>
    </Card>
  );
};
