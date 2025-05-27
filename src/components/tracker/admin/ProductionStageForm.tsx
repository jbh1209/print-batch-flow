
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit } from "lucide-react";

interface ProductionStage {
  id?: string;
  name: string;
  description?: string;
  order_index: number;
  color: string;
  is_active: boolean;
}

interface ProductionStageFormProps {
  stage?: ProductionStage;
  onSubmit: (stageData: Omit<ProductionStage, 'id'>) => Promise<boolean>;
  trigger?: React.ReactNode;
  maxOrderIndex?: number;
}

export const ProductionStageForm = ({ stage, onSubmit, trigger, maxOrderIndex = 0 }: ProductionStageFormProps) => {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: stage?.name || '',
    description: stage?.description || '',
    order_index: stage?.order_index || maxOrderIndex + 1,
    color: stage?.color || '#6B7280',
    is_active: stage?.is_active ?? true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const success = await onSubmit(formData);
    
    if (success) {
      setOpen(false);
      if (!stage) {
        setFormData({
          name: '',
          description: '',
          order_index: maxOrderIndex + 2,
          color: '#6B7280',
          is_active: true
        });
      }
    }
    
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm">
            {stage ? <Edit className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {stage ? 'Edit' : 'Add Stage'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{stage ? 'Edit Production Stage' : 'Add New Production Stage'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          
          <div>
            <Label htmlFor="order_index">Order Index</Label>
            <Input
              id="order_index"
              type="number"
              min="1"
              value={formData.order_index}
              onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) || 1 })}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="color">Color</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="color"
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-16 h-10"
              />
              <Input
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="#6B7280"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Active</Label>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : (stage ? 'Update' : 'Create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
