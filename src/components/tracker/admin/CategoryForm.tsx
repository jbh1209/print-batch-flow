
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit } from "lucide-react";

interface Category {
  id?: string;
  name: string;
  description?: string;
  sla_target_days: number;
  color: string;
}

interface CategoryFormProps {
  category?: Category;
  onSubmit: (categoryData: Omit<Category, 'id'>) => Promise<boolean>;
  trigger?: React.ReactNode;
}

export const CategoryForm = ({ category, onSubmit, trigger }: CategoryFormProps) => {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: category?.name || '',
    description: category?.description || '',
    sla_target_days: category?.sla_target_days || 3,
    color: category?.color || '#3B82F6'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const success = await onSubmit(formData);
    
    if (success) {
      setOpen(false);
      if (!category) {
        setFormData({
          name: '',
          description: '',
          sla_target_days: 3,
          color: '#3B82F6'
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
            {category ? <Edit className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {category ? 'Edit' : 'Add Category'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? 'Edit Category' : 'Add New Category'}</DialogTitle>
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
            <Label htmlFor="sla_target_days">SLA Target Days</Label>
            <Input
              id="sla_target_days"
              type="number"
              min="1"
              value={formData.sla_target_days}
              onChange={(e) => setFormData({ ...formData, sla_target_days: parseInt(e.target.value) || 3 })}
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
                placeholder="#3B82F6"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : (category ? 'Update' : 'Create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
