import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Plus, Edit, Trash2, Settings, Clock, Gauge, AlertCircle } from "lucide-react";
import { useStageSpecifications } from "@/hooks/tracker/useStageSpecifications";
import { stagingHelpers } from "@/hooks/tracker/stagingSystemUtils";
import type { StageSpecification } from "@/hooks/tracker/useStageSpecifications";
import type { ProductionStage } from "@/hooks/tracker/useProductionStages";

interface StageSpecificationsManagerProps {
  stage: ProductionStage;
  onUpdate?: () => void;
}

export const StageSpecificationsManager: React.FC<StageSpecificationsManagerProps> = ({
  stage,
  onUpdate
}) => {
  const { specifications, isLoading, error, createSpecification, updateSpecification, deleteSpecification } = useStageSpecifications(stage.id);
  const [selectedSpec, setSelectedSpec] = useState<StageSpecification | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleCreateSpec = () => {
    setSelectedSpec(null);
    setIsDialogOpen(true);
  };

  const handleEditSpec = (spec: StageSpecification) => {
    setSelectedSpec(spec);
    setIsDialogOpen(true);
  };

  const handleSaveSpec = async (specData: Omit<StageSpecification, 'id' | 'created_at' | 'updated_at'>) => {
    if (selectedSpec) {
      await updateSpecification(selectedSpec.id, specData);
    } else {
      await createSpecification(specData);
    }
    setIsDialogOpen(false);
    setSelectedSpec(null);
    onUpdate?.();
  };

  const handleDeleteSpec = async (specId: string) => {
    await deleteSpecification(specId);
    onUpdate?.();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Stage Specifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingSpinner message="Loading specifications..." />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Stage Specifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Stage Specifications
        </CardTitle>
        <Button onClick={handleCreateSpec} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Specification
        </Button>
      </CardHeader>
      <CardContent>
        {specifications.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-sm">No specifications defined for this stage</p>
            <p className="text-xs mt-1">Create specifications to handle different printing methods, colors, or materials</p>
          </div>
        ) : (
          <div className="space-y-3">
            {specifications.map((spec) => (
              <SpecificationCard
                key={spec.id}
                specification={spec}
                stage={stage}
                onEdit={handleEditSpec}
                onDelete={handleDeleteSpec}
              />
            ))}
          </div>
        )}

        <SpecificationDialog
          stage={stage}
          specification={selectedSpec}
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onSave={handleSaveSpec}
        />
      </CardContent>
    </Card>
  );
};

interface SpecificationCardProps {
  specification: StageSpecification;
  stage: ProductionStage;
  onEdit: (spec: StageSpecification) => void;
  onDelete: (specId: string) => void;
}

const SpecificationCard: React.FC<SpecificationCardProps> = ({
  specification,
  stage,
  onEdit,
  onDelete
}) => {
  const effectiveTimingData = stagingHelpers.getEffectiveTimingData(stage, specification);
  const hasOverrides = specification.running_speed_per_hour || specification.make_ready_time_minutes;

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-medium">{specification.name}</h4>
          {hasOverrides && (
            <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200">
              <Clock className="h-3 w-3 mr-1" />
              Custom Timing
            </Badge>
          )}
        </div>
        
        {specification.description && (
          <p className="text-sm text-muted-foreground mb-2">{specification.description}</p>
        )}
        
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="flex items-center gap-1">
            <Gauge className="h-3 w-3 text-blue-600" />
            <span>Speed: {stagingHelpers.formatSpeed(
              effectiveTimingData.running_speed_per_hour || 0, 
              effectiveTimingData.speed_unit || 'sheets_per_hour'
            )}</span>
          </div>
          <div className="flex items-center gap-1">
            <Settings className="h-3 w-3 text-blue-600" />
            <span>Setup: {stagingHelpers.formatDuration(effectiveTimingData.make_ready_time_minutes || 10)}</span>
          </div>
        </div>
      </div>
      
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(specification)}
        >
          <Edit className="h-3 w-3" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Trash2 className="h-3 w-3" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Specification</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{specification.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(specification.id)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

interface SpecificationDialogProps {
  stage: ProductionStage;
  specification: StageSpecification | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (specData: Omit<StageSpecification, 'id' | 'created_at' | 'updated_at'>) => void;
}

const SpecificationDialog: React.FC<SpecificationDialogProps> = ({
  stage,
  specification,
  isOpen,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    running_speed_per_hour: undefined as number | undefined,
    make_ready_time_minutes: undefined as number | undefined,
    speed_unit: 'sheets_per_hour' as 'sheets_per_hour' | 'items_per_hour' | 'minutes_per_item',
    properties: {}
  });

  React.useEffect(() => {
    if (specification) {
      setFormData({
        name: specification.name,
        description: specification.description || '',
        running_speed_per_hour: specification.running_speed_per_hour || undefined,
        make_ready_time_minutes: specification.make_ready_time_minutes || undefined,
        speed_unit: specification.speed_unit || 'sheets_per_hour',
        properties: specification.properties || {}
      });
    } else {
      setFormData({
        name: '',
        description: '',
        running_speed_per_hour: undefined,
        make_ready_time_minutes: undefined,
        speed_unit: 'sheets_per_hour',
        properties: {}
      });
    }
  }, [specification]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      production_stage_id: stage.id,
      name: formData.name,
      description: formData.description || null,
      running_speed_per_hour: formData.running_speed_per_hour || null,
      make_ready_time_minutes: formData.make_ready_time_minutes || null,
      speed_unit: formData.speed_unit,
      properties: formData.properties,
      is_active: true
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {specification ? 'Edit' : 'Create'} Stage Specification
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Specification Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. B2 - 4 Process Colors"
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description"
              />
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Override stage defaults only if this specification has different timing requirements.
              Leave blank to inherit from stage settings.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="running_speed_per_hour">Override Speed (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="running_speed_per_hour"
                  type="number"
                  value={formData.running_speed_per_hour || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    running_speed_per_hour: e.target.value ? parseInt(e.target.value) : undefined 
                  }))}
                  placeholder={`Stage default: ${stage.running_speed_per_hour || 'Not set'}`}
                />
                <Select
                  value={formData.speed_unit}
                  onValueChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    speed_unit: value as 'sheets_per_hour' | 'items_per_hour' | 'minutes_per_item' 
                  }))}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sheets_per_hour">Sheets/Hour</SelectItem>
                    <SelectItem value="items_per_hour">Items/Hour</SelectItem>
                    <SelectItem value="minutes_per_item">Minutes/Item</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="make_ready_time_minutes">Override Setup Time (Optional)</Label>
              <Input
                id="make_ready_time_minutes"
                type="number"
                value={formData.make_ready_time_minutes || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  make_ready_time_minutes: e.target.value ? parseInt(e.target.value) : undefined 
                }))}
                placeholder={`Stage default: ${stage.make_ready_time_minutes || 10} min`}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {specification ? 'Update' : 'Create'} Specification
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};