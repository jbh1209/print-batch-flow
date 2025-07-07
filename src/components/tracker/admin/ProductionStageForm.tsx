import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProductionStage {
  id?: string;
  name: string;
  description?: string;
  color: string;
  order_index: number;
  is_active: boolean;
  supports_parts: boolean;
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
    supports_parts: stage?.supports_parts || false
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (stage) {
      console.log('🔧 ProductionStageForm received stage:', stage);
      
      const updatedFormData = {
        name: stage.name,
        description: stage.description || '',
        color: stage.color,
        order_index: stage.order_index,
        is_active: stage.is_active,
        supports_parts: stage.supports_parts || false
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
        ...formData
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

          <div className="flex items-center space-x-2">
            <Checkbox
              id="supports_parts"
              checked={formData.supports_parts}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, supports_parts: !!checked }))}
            />
            <Label htmlFor="supports_parts" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Supports Part-Specific Work
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Enable this for stages that can handle part-specific work (cover, text, insert parts)
          </p>
        </CardContent>
      </Card>

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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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