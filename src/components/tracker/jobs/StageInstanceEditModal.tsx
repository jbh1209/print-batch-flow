import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Clock, Package, Target, Wrench } from "lucide-react";
import { useStageSpecifications } from "@/hooks/tracker/useStageSpecifications";
import { toast } from "sonner";
import { SubTaskList } from "../common/SubTaskList";
import { supabase } from "@/integrations/supabase/client";

interface StageInstanceData {
  stageId: string;
  stageName: string;
  stageColor: string;
  quantity: number | null;
  estimatedDurationMinutes: number | null;
  partAssignment: 'cover' | 'text' | 'both' | null;
  stageSpecificationId: string | null;
}

interface StageInstanceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobData: {
    id: string;
    wo_no: string;
    qty: number;
  };
  stageData: StageInstanceData;
  onSave: (updatedData: StageInstanceData) => void;
}

export const StageInstanceEditModal: React.FC<StageInstanceEditModalProps> = ({
  isOpen,
  onClose,
  jobData,
  stageData,
  onSave
}) => {
  const [formData, setFormData] = useState<StageInstanceData>(stageData);
  const [isSaving, setIsSaving] = useState(false);
  const [stageInstanceId, setStageInstanceId] = useState<string | null>(null);
  const [hasSubTasks, setHasSubTasks] = useState(false);
  
  // Get stage specifications for this production stage
  const { 
    specifications, 
    isLoading: isLoadingSpecs 
  } = useStageSpecifications(stageData.stageId);

  // Fetch stage instance ID to check for sub-tasks
  useEffect(() => {
    const fetchStageInstance = async () => {
      if (!isOpen || !jobData?.id || !stageData?.stageId) return;
      
      try {
        const { data, error } = await supabase
          .from('job_stage_instances')
          .select('id')
          .eq('job_id', jobData.id)
          .eq('production_stage_id', stageData.stageId)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching stage instance:', error);
          return;
        }
        
        if (data) {
          setStageInstanceId(data.id);
          
          // Check if sub-tasks exist
          const { data: subTasks } = await supabase
            .rpc('get_stage_sub_tasks', { p_stage_instance_id: data.id });
          
          setHasSubTasks(subTasks && subTasks.length > 0);
        }
      } catch (err) {
        console.error('Error in fetchStageInstance:', err);
      }
    };
    
    fetchStageInstance();
  }, [isOpen, jobData?.id, stageData?.stageId]);

  // Reset form when modal opens or stage data changes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        ...stageData,
        // Auto-inherit job quantity if stage quantity is null
        quantity: stageData.quantity ?? jobData.qty
      });
    }
  }, [isOpen, stageData, jobData.qty]);

  const handleQuantityChange = (value: string) => {
    const numValue = parseInt(value);
    setFormData(prev => ({
      ...prev,
      quantity: isNaN(numValue) || numValue <= 0 ? null : numValue
    }));
  };

  const handleDurationChange = (value: string) => {
    const numValue = parseInt(value);
    setFormData(prev => ({
      ...prev,
      estimatedDurationMinutes: isNaN(numValue) || numValue <= 0 ? null : numValue
    }));
  };

  const calculateEstimatedDuration = () => {
    const specArray = Array.isArray(specifications) ? specifications : [];
    const selectedSpec = specArray.find(s => s.id === formData.stageSpecificationId);
    if (selectedSpec && formData.quantity && selectedSpec.running_speed_per_hour) {
      const hours = formData.quantity / selectedSpec.running_speed_per_hour;
      const minutes = Math.ceil(hours * 60);
      const totalMinutes = minutes + (selectedSpec.make_ready_time_minutes || 0);
      
      setFormData(prev => ({
        ...prev,
        estimatedDurationMinutes: totalMinutes
      }));
      
      toast.success(`Calculated duration: ${totalMinutes} minutes`);
    } else {
      toast.warning("Missing data for calculation (quantity, specification, or speed)");
    }
  };

  const handleSpecificationChange = (specId: string) => {
    setFormData(prev => ({
      ...prev,
      stageSpecificationId: specId || null
    }));
  };

  const handlePartAssignmentChange = (assignment: string) => {
    setFormData(prev => ({
      ...prev,
      partAssignment: assignment as 'cover' | 'text' | 'both' | null
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Validate required fields
      if (!formData.quantity || formData.quantity <= 0) {
        toast.error("Quantity is required and must be greater than 0");
        return;
      }

      console.log('💾 Saving stage instance configuration:', formData);
      onSave(formData);
      onClose();
      toast.success("Stage configuration saved successfully");
    } catch (err) {
      console.error('❌ Error saving stage configuration:', err);
      toast.error("Failed to save stage configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const getPartAssignmentBadgeColor = (assignment: string | null) => {
    switch (assignment) {
      case 'cover': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'text': return 'bg-green-100 text-green-800 border-green-200';
      case 'both': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configure Stage: {stageData.stageName}
          </DialogTitle>
          <DialogDescription>
            Configure quantity, duration, and specifications for this stage in job {jobData.wo_no}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Stage Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4" />
                Stage Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Badge 
                  variant="outline"
                  style={{ 
                    backgroundColor: `${stageData.stageColor}20`, 
                    color: stageData.stageColor, 
                    borderColor: `${stageData.stageColor}40` 
                  }}
                >
                  {stageData.stageName}
                </Badge>
                {formData.partAssignment && (
                  <Badge 
                    variant="outline" 
                    className={getPartAssignmentBadgeColor(formData.partAssignment)}
                  >
                    {formData.partAssignment.toUpperCase()}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quantity Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Quantity & Part Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantity">Stage Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={formData.quantity || ''}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    placeholder={`Job quantity: ${jobData.qty}`}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Default: {jobData.qty} (job quantity)
                  </p>
                </div>

                <div>
                  <Label htmlFor="part-assignment">Part Assignment</Label>
                  <Select
                    value={formData.partAssignment || 'none'}
                    onValueChange={handlePartAssignmentChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select part..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific part</SelectItem>
                      <SelectItem value="cover">Cover Only</SelectItem>
                      <SelectItem value="text">Text Only</SelectItem>
                      <SelectItem value="both">Cover + Text</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stage Operations (Sub-Tasks) */}
          {stageInstanceId && hasSubTasks && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Stage Operations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground mb-3">
                    This stage has multiple operations configured:
                  </p>
                  <SubTaskList
                    stageInstanceId={stageInstanceId}
                    mode="read-only"
                    showActions={false}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Duration & Specifications */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Duration & Specifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="specification">Stage Specification</Label>
                <Select
                  value={formData.stageSpecificationId || 'none'}
                  onValueChange={handleSpecificationChange}
                  disabled={isLoadingSpecs}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingSpecs ? "Loading..." : "Select specification..."} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specification</SelectItem>
                    {Array.isArray(specifications) ? specifications.map(spec => (
                      <SelectItem key={spec.id} value={spec.id}>
                        {spec.name} 
                        {spec.running_speed_per_hour && ` (${spec.running_speed_per_hour}/hr)`}
                      </SelectItem>
                    )) : null}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="duration">Estimated Duration (minutes)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="duration"
                      type="number"
                      min="1"
                      value={formData.estimatedDurationMinutes || ''}
                      onChange={(e) => handleDurationChange(e.target.value)}
                      placeholder="Enter duration..."
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={calculateEstimatedDuration}
                      disabled={!formData.quantity || !formData.stageSpecificationId}
                      className="shrink-0"
                    >
                      Calculate
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Click calculate to auto-estimate from specification
                  </p>
                </div>

                <div>
                  <Label>Calculation Preview</Label>
                  <div className="text-sm bg-muted p-2 rounded">
                    {formData.quantity && formData.stageSpecificationId ? (
                      <>
                        <div>Qty: {formData.quantity}</div>
                        {(() => {
                          const specArray = Array.isArray(specifications) ? specifications : [];
                          const selectedSpec = specArray.find(s => s.id === formData.stageSpecificationId);
                          return selectedSpec ? (
                            <>
                              <div>Speed: {selectedSpec.running_speed_per_hour || 'N/A'}/hr</div>
                              <div>Setup: {selectedSpec.make_ready_time_minutes || 0} min</div>
                            </>
                          ) : null;
                        })()}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Select quantity & specification</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isSaving || !formData.quantity}
          >
            {isSaving ? "Saving..." : "Save Configuration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};