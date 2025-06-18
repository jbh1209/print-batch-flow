
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Play, 
  CheckCircle, 
  RotateCcw,
  Clock,
  AlertTriangle,
  ChevronRight
} from "lucide-react";
import { JobStageInstance } from "@/hooks/tracker/useJobStageInstances";
import { useStageActions } from "@/hooks/tracker/stage-management/useStageActions";
import { toast } from "sonner";

interface MasterOrderModalAdminControlsProps {
  stage: JobStageInstance;
  onRefresh: () => void;
}

export const MasterOrderModalAdminControls: React.FC<MasterOrderModalAdminControlsProps> = ({
  stage,
  onRefresh
}) => {
  const [notes, setNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { startStage, completeStage } = useStageActions();

  const handleStartStage = async () => {
    setIsProcessing(true);
    try {
      const success = await startStage(stage.id);
      if (success) {
        toast.success(`Started ${stage.production_stage.name}`);
        onRefresh();
        setNotes("");
      }
    } catch (error) {
      console.error('Error starting stage:', error);
      toast.error("Failed to start stage");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteStage = async () => {
    setIsProcessing(true);
    try {
      const success = await completeStage(stage.id, notes);
      if (success) {
        toast.success(`Completed ${stage.production_stage.name}`);
        onRefresh();
        setNotes("");
      }
    } catch (error) {
      console.error('Error completing stage:', error);
      toast.error("Failed to complete stage");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetToPending = async () => {
    setIsProcessing(true);
    try {
      // Direct database call to reset stage to pending
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'pending',
          started_at: null,
          completed_at: null,
          started_by: null,
          completed_by: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', stage.id);

      if (error) throw error;

      toast.success(`Reset ${stage.production_stage.name} to pending`);
      onRefresh();
      setNotes("");
    } catch (error) {
      console.error('Error resetting stage:', error);
      toast.error("Failed to reset stage");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleForceAdvance = async () => {
    if (!notes.trim()) {
      toast.error("Please add notes explaining why you're force advancing this stage");
      return;
    }

    setIsProcessing(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          notes: `[ADMIN FORCE ADVANCE] ${notes}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', stage.id);

      if (error) throw error;

      toast.success(`Force advanced ${stage.production_stage.name}`);
      onRefresh();
      setNotes("");
    } catch (error) {
      console.error('Error force advancing stage:', error);
      toast.error("Failed to force advance stage");
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Play className="h-4 w-4 text-blue-600" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-400" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-orange-100 text-orange-800';
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getStatusIcon(stage.status)}
          <div>
            <h4 className="font-medium">{stage.production_stage.name}</h4>
            {stage.part_name && (
              <p className="text-sm text-gray-600">Part: {stage.part_name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={getStatusColor(stage.status)}>
            {stage.status}
          </Badge>
          <span className="text-sm text-gray-500">
            Order: {stage.stage_order}
          </span>
        </div>
      </div>

      {/* Stage Details */}
      {(stage.started_at || stage.completed_at || stage.notes) && (
        <div className="grid grid-cols-2 gap-4 text-sm border-t pt-3">
          {stage.started_at && (
            <div>
              <label className="font-medium text-gray-500">Started At</label>
              <p>{new Date(stage.started_at).toLocaleString()}</p>
            </div>
          )}
          {stage.completed_at && (
            <div>
              <label className="font-medium text-gray-500">Completed At</label>
              <p>{new Date(stage.completed_at).toLocaleString()}</p>
            </div>
          )}
          {stage.notes && (
            <div className="col-span-2">
              <label className="font-medium text-gray-500">Notes</label>
              <p className="text-gray-700">{stage.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Admin Controls */}
      <div className="space-y-3 border-t pt-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium text-amber-700">Admin Controls</span>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`notes-${stage.id}`}>Admin Notes</Label>
          <Textarea
            id={`notes-${stage.id}`}
            placeholder="Add notes for this action..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[60px]"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {stage.status === 'pending' && (
            <Button
              onClick={handleStartStage}
              disabled={isProcessing}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              <Play className="h-3 w-3 mr-1" />
              Start
            </Button>
          )}

          {stage.status === 'active' && (
            <Button
              onClick={handleCompleteStage}
              disabled={isProcessing}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Complete
            </Button>
          )}

          {(stage.status === 'active' || stage.status === 'completed') && (
            <Button
              onClick={handleResetToPending}
              disabled={isProcessing}
              size="sm"
              variant="outline"
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset to Pending
            </Button>
          )}

          {stage.status === 'pending' && (
            <Button
              onClick={handleForceAdvance}
              disabled={isProcessing || !notes.trim()}
              size="sm"
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              <ChevronRight className="h-3 w-3 mr-1" />
              Force Advance
            </Button>
          )}
        </div>

        {stage.status === 'pending' && (
          <p className="text-xs text-amber-600">
            Force Advance requires notes and will mark stage as completed without proper workflow.
          </p>
        )}
      </div>
    </div>
  );
};
