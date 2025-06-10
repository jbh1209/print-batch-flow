
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MultiPartStageBuilder } from "./MultiPartStageBuilder";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProductionStage {
  id?: string;
  name: string;
  description?: string;
  color: string;
  order_index: number;
  is_active: boolean;
  is_multi_part: boolean;
  part_definitions: string[];
}

interface ProductionStageFormProps {
  stage?: ProductionStage;
  onSave: () => void;
  onCancel: () => void;
  trigger?: React.ReactNode;
}

export const ProductionStageForm: React.FC<ProductionStageFormProps> = ({
  stage,
  onSave,
  onCancel,
  trigger
}) => {
  const [formData, setFormData] = useState<ProductionStage>({
    name: stage?.name || '',
    description: stage?.description || '',
    color: stage?.color || '#6B7280',
    order_index: stage?.order_index || 0,
    is_active: stage?.is_active ?? true,
    is_multi_part: stage?.is_multi_part || false,
    part_definitions: stage?.part_definitions || []
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (stage) {
      console.log('🔧 ProductionStageForm received stage:', stage);
      
      // The stage should already have properly typed part_definitions from the hook
      let partDefinitions: string[] = [];
      
      if (stage.part_definitions) {
        if (Array.isArray(stage.part_definitions)) {
          partDefinitions = stage.part_definitions;
        } else {
          console.warn('⚠️ part_definitions is not an array, attempting to parse:', stage.part_definitions);
          try {
            partDefinitions = typeof stage.part_definitions === 'string' 
              ? JSON.parse(stage.part_definitions) 
              : [];
          } catch {
            partDefinitions = [];
          }
        }
      }

      const updatedFormData = {
        name: stage.name,
        description: stage.description || '',
        color: stage.color,
        order_index: stage.order_index,
        is_active: stage.is_active,
        is_multi_part: stage.is_multi_part || false,
        part_definitions: partDefinitions
      };

      console.log('✅ ProductionStageForm updated formData:', updatedFormData);
      setFormData(updatedFormData);
    }
  }, [stage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('💾 Saving stage with data:', formData);
      
      const stageData = {
        ...formData,
        // Send part_definitions as array directly - Supabase will handle JSONB conversion
        part_definitions: formData.part_definitions
      };

      if (stage?.id) {
        // Update existing stage
        const { error } = await supabase
          .from('production_stages')
          .update(stageData)
          .eq('id', stage.id);

        if (error) throw error;
        toast.success('Production stage updated successfully');
      } else {
        // Create new stage
        const { error } = await supabase
          .from('production_stages')
          .insert([stageData]);

        if (error) throw error;
        toast.success('Production stage created successfully');
      }

      setIsOpen(false);
      onSave();
    } catch (err) {
      console.error('❌ Error saving production stage:', err);
      toast.error('Failed to save production stage');
    } finally {
      setIsLoading(false);
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Stage Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="color">Color</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="w-20"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  placeholder="#6B7280"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="order_index">Order Index</Label>
              <Input
                id="order_index"
                type="number"
                value={formData.order_index}
                onChange={(e) => setFormData(prev => ({ ...prev, order_index: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <MultiPartStageBuilder
        isMultiPart={formData.is_multi_part}
        partDefinitions={formData.part_definitions}
        onMultiPartChange={(isMultiPart) => {
          console.log('🔄 Multi-part changed to:', isMultiPart);
          setFormData(prev => ({ ...prev, is_multi_part: isMultiPart }));
        }}
        onPartDefinitionsChange={(parts) => {
          console.log('🔄 Part definitions changed to:', parts);
          setFormData(prev => ({ ...prev, part_definitions: parts }));
        }}
      />

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={() => { setIsOpen(false); onCancel(); }} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : stage?.id ? 'Update' : 'Create'} Stage
        </Button>
      </div>
    </form>
  );

  if (trigger) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {stage?.id ? 'Edit Production Stage' : 'Create New Production Stage'}
            </DialogTitle>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>
    );
  }

  return formContent;
};
