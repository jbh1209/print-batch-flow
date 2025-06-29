
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Package } from 'lucide-react';
import { usePrintSpecifications, PrintSpecification } from '@/hooks/usePrintSpecifications';
import { toast } from 'sonner';

const SPECIFICATION_CATEGORIES = [
  { value: 'paper_type', label: 'Paper Type', description: 'Paper surface finish and coating' },
  { value: 'paper_weight', label: 'Paper Weight', description: 'Paper thickness and weight specifications' },
  { value: 'size', label: 'Size', description: 'Print dimensions and format sizes' },
  { value: 'lamination_type', label: 'Lamination Type', description: 'Post-printing lamination finishes' },
  { value: 'uv_varnish', label: 'UV Varnish', description: 'UV coating applications' }
];

export const PrintSpecificationsManagement = () => {
  const { specifications, isLoading, createSpecification, updateSpecification, deleteSpecification } = usePrintSpecifications();
  const [selectedCategory, setSelectedCategory] = useState('paper_type');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingSpec, setEditingSpec] = useState<PrintSpecification | null>(null);

  const [formData, setFormData] = useState({
    category: '',
    name: '',
    display_name: '',
    description: '',
    properties: '{}',
    is_active: true,
    sort_order: 0
  });

  const resetForm = () => {
    setFormData({
      category: selectedCategory,
      name: '',
      display_name: '',
      description: '',
      properties: '{}',
      is_active: true,
      sort_order: 0
    });
    setEditingSpec(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let properties = {};
      if (formData.properties.trim()) {
        properties = JSON.parse(formData.properties);
      }

      const specData = {
        ...formData,
        properties
      };

      if (editingSpec) {
        await updateSpecification(editingSpec.id, specData);
      } else {
        await createSpecification(specData);
      }

      resetForm();
      setIsCreateDialogOpen(false);
    } catch (error) {
      if (error instanceof SyntaxError) {
        toast.error('Invalid JSON in properties field');
      }
    }
  };

  const startEdit = (spec: PrintSpecification) => {
    setFormData({
      category: spec.category,
      name: spec.name,
      display_name: spec.display_name,
      description: spec.description || '',
      properties: JSON.stringify(spec.properties, null, 2),
      is_active: spec.is_active,
      sort_order: spec.sort_order
    });
    setEditingSpec(spec);
    setIsCreateDialogOpen(true);
  };

  const handleDelete = async (spec: PrintSpecification) => {
    if (confirm(`Are you sure you want to delete "${spec.display_name}"?`)) {
      await deleteSpecification(spec.id);
    }
  };

  const filteredSpecs = specifications.filter(
    spec => spec.category === selectedCategory && spec.name !== '_category'
  );

  const categoryInfo = SPECIFICATION_CATEGORIES.find(cat => cat.value === selectedCategory);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Print Specifications Management</h2>
          <p className="text-muted-foreground">
            Manage central print specifications for all products
          </p>
        </div>
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="grid w-full grid-cols-5">
          {SPECIFICATION_CATEGORIES.map((category) => (
            <TabsTrigger key={category.value} value={category.value}>
              {category.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {SPECIFICATION_CATEGORIES.map((category) => (
          <TabsContent key={category.value} value={category.value}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {category.label}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {category.description}
                  </p>
                </div>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={() => {
                        resetForm();
                        setFormData(prev => ({ ...prev, category: category.value }));
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add {category.label}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>
                        {editingSpec ? 'Edit' : 'Add'} {categoryInfo?.label}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="name">Name/Key</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g., matt_170gsm"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="display_name">Display Name</Label>
                          <Input
                            id="display_name"
                            value={formData.display_name}
                            onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                            placeholder="e.g., Matt 170gsm"
                            required
                          />
                        </div>
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

                      <div>
                        <Label htmlFor="properties">Properties (JSON)</Label>
                        <Textarea
                          id="properties"
                          value={formData.properties}
                          onChange={(e) => setFormData(prev => ({ ...prev, properties: e.target.value }))}
                          placeholder='{"weight": 170, "finish": "matt"}'
                          rows={4}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Additional properties as JSON object
                        </p>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="is_active"
                            checked={formData.is_active}
                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                          />
                          <Label htmlFor="is_active">Active</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Label htmlFor="sort_order">Sort Order</Label>
                          <Input
                            id="sort_order"
                            type="number"
                            value={formData.sort_order}
                            onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                            className="w-20"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setIsCreateDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit">
                          {editingSpec ? 'Update' : 'Create'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading specifications...</div>
                ) : filteredSpecs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No {category.label.toLowerCase()} specifications created yet.
                    <br />
                    Click "Add {category.label}" to create your first specification.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredSpecs.map((spec) => (
                      <div
                        key={spec.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{spec.display_name}</span>
                            <Badge variant={spec.is_active ? "default" : "secondary"}>
                              {spec.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Key: {spec.name}
                            {spec.description && ` • ${spec.description}`}
                          </div>
                          {Object.keys(spec.properties).length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Properties: {JSON.stringify(spec.properties)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(spec)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(spec)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
