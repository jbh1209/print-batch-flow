
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Play, CheckCircle, Mail, ThumbsUp, Printer } from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DtpWorkflowCardProps {
  job: AccessibleJob;
  onRefresh: () => void;
}

export const DtpWorkflowCard: React.FC<DtpWorkflowCardProps> = ({
  job,
  onRefresh
}) => {
  const { user } = useAuth();
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");
  const [printers, setPrinters] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load printers when component mounts
  React.useEffect(() => {
    const loadPrinters = async () => {
      const { data } = await supabase
        .from('printers')
        .select('*')
        .eq('status', 'active')
        .order('name');
      
      if (data) {
        setPrinters(data);
      }
    };
    loadPrinters();
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

  const handleProofApproved = async () => {
    setIsLoading(true);
    try {
      // Mark proof as approved and complete the stage
      const { error: approveError } = await supabase
        .from('job_stage_instances')
        .update({
          proof_approved_manually_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('job_id', job.job_id)
        .eq('production_stage_id', job.current_stage_id);

      if (approveError) throw approveError;

      // Advance to next stage
      const { error: advanceError } = await supabase.rpc('advance_job_stage', {
        p_job_id: job.job_id,
        p_job_table_name: 'production_jobs',
        p_current_stage_id: job.current_stage_id,
        p_notes: 'Proof approved by client'
      });

      if (advanceError) throw advanceError;

      // Update job status
      const { error: jobError } = await supabase
        .from('production_jobs')
        .update({
          status: 'Approved - Ready to Print',
          updated_at: new Date().toISOString()
        })
        .eq('id', job.job_id);

      if (jobError) throw jobError;

      toast.success("Proof approved - job ready for printing");
      onRefresh();
    } catch (error) {
      console.error('Error approving proof:', error);
      toast.error("Failed to approve proof");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrinterSelection = async () => {
    if (!selectedPrinter) {
      toast.error("Please select a printer");
      return;
    }

    setIsLoading(true);
    try {
      // Update the job stage instance with selected printer
      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          printer_id: selectedPrinter,
          updated_at: new Date().toISOString()
        })
        .eq('job_id', job.job_id)
        .eq('production_stage_id', job.current_stage_id);

      if (error) throw error;

      toast.success("Printer assigned successfully");
      onRefresh();
    } catch (error) {
      console.error('Error assigning printer:', error);
      toast.error("Failed to assign printer");
    } finally {
      setIsLoading(false);
    }
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
          
          <Button 
            onClick={handleProofApproved}
            disabled={isLoading}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            <ThumbsUp className="h-4 w-4 mr-2" />
            Proof Approved
          </Button>

          {/* Printer Selection */}
          <div className="space-y-2">
            <Label>Select Printer for Production:</Label>
            <div className="flex gap-2">
              <Select value={selectedPrinter} onValueChange={setSelectedPrinter}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Choose printer..." />
                </SelectTrigger>
                <SelectContent>
                  {printers.map((printer) => (
                    <SelectItem key={printer.id} value={printer.id}>
                      {printer.name} ({printer.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handlePrinterSelection}
                disabled={!selectedPrinter || isLoading}
                size="sm"
              >
                <Printer className="h-4 w-4 mr-1" />
                Assign
              </Button>
            </div>
          </div>
        </div>
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
