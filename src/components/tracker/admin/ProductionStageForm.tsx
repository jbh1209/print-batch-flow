
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
}

export const ProductionStageForm: React.FC<ProductionStageFormProps> = ({
  stage,
  onSave,
  onCancel
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

  useEffect(() => {
    if (stage) {
      setFormData({
        name: stage.name,
        description: stage.description || '',
        color: stage.color,
        order_index: stage.order_index,
        is_active: stage.is_active,
        is_multi_part: stage.is_multi_part || false,
        part_definitions: stage.part_definitions || []
      });
    }
  }, [stage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const stageData = {
        ...formData,
        part_definitions: JSON.stringify(formData.part_definitions)
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

      onSave();
    } catch (err) {
      console.error('Error saving production stage:', err);
      toast.error('Failed to save production stage');
    } finally {
      setIsLoading(false);
    }
  };

  return (
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
        onMultiPartChange={(isMultiPart) => 
          setFormData(prev => ({ ...prev, is_multi_part: isMultiPart }))
        }
        onPartDefinitionsChange={(parts) => 
          setFormData(prev => ({ ...prev, part_definitions: parts }))
        }
      />

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : stage?.id ? 'Update' : 'Create'} Stage
        </Button>
      </div>
    </form>
  );
};
