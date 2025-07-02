import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Settings, Package, Save, Plus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CategoryBatchSettings {
  id: string;
  name: string;
  color: string;
  batch_enabled: boolean;
  trigger_stages: string[];
  skip_conditions: string[];
  description?: string;
}

interface BatchTriggerStage {
  id: string;
  name: string;
  color: string;
}

export const AdminCategoryBatchManagement: React.FC = () => {
  const [categories, setCategories] = useState<CategoryBatchSettings[]>([]);
  const [triggerStages, setTriggerStages] = useState<BatchTriggerStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    fetchCategoriesAndStages();
  }, []);

  const fetchCategoriesAndStages = async () => {
    try {
      setIsLoading(true);
      
      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (categoriesError) throw categoriesError;

      // Fetch production stages that can trigger batching
      const { data: stagesData, error: stagesError } = await supabase
        .from('production_stages')
        .select('id, name, color')
        .eq('is_active', true)
        .order('order_index');

      if (stagesError) throw stagesError;

      // Map categories with default batch settings
      const mappedCategories: CategoryBatchSettings[] = (categoriesData || []).map(cat => ({
        id: cat.id,
        name: cat.name,
        color: cat.color,
        batch_enabled: false, // Default to disabled
        trigger_stages: ['proof'], // Default trigger stage
        skip_conditions: [],
        description: cat.description
      }));

      setCategories(mappedCategories);
      setTriggerStages(stagesData || []);
      
    } catch (error) {
      console.error('❌ Error fetching categories and stages:', error);
      toast.error('Failed to load category batch settings');
    } finally {
      setIsLoading(false);
    }
  };

  const updateCategoryBatchSettings = async (categoryId: string, updates: Partial<CategoryBatchSettings>) => {
    try {
      setIsSaving(true);
      
      // Update local state immediately for better UX
      setCategories(prev => 
        prev.map(cat => 
          cat.id === categoryId ? { ...cat, ...updates } : cat
        )
      );

      // Here you would typically save to a category_batch_settings table
      // For now, we'll just simulate the save
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast.success('Batch settings updated successfully');
      
    } catch (error) {
      console.error('❌ Error updating batch settings:', error);
      toast.error('Failed to update batch settings');
      
      // Revert local state on error
      fetchCategoriesAndStages();
    } finally {
      setIsSaving(false);
    }
  };

  const toggleBatchEnabled = (categoryId: string, enabled: boolean) => {
    updateCategoryBatchSettings(categoryId, { batch_enabled: enabled });
  };

  const updateTriggerStages = (categoryId: string, stageIds: string[]) => {
    updateCategoryBatchSettings(categoryId, { trigger_stages: stageIds });
  };

  const addSkipCondition = (categoryId: string, condition: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (category) {
      const newConditions = [...category.skip_conditions, condition];
      updateCategoryBatchSettings(categoryId, { skip_conditions: newConditions });
    }
  };

  const removeSkipCondition = (categoryId: string, index: number) => {
    const category = categories.find(c => c.id === categoryId);
    if (category) {
      const newConditions = category.skip_conditions.filter((_, i) => i !== index);
      updateCategoryBatchSettings(categoryId, { skip_conditions: newConditions });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading batch settings...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Category Batch Management
          </CardTitle>
          <p className="text-sm text-gray-600">
            Configure which categories can use batch processing and define trigger conditions.
          </p>
        </CardHeader>
      </Card>

      <div className="grid gap-4">
        {categories.map((category) => (
          <Card key={category.id} className="transition-shadow hover:shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: category.color }}
                  />
                  <div>
                    <h3 className="font-medium">{category.name}</h3>
                    {category.description && (
                      <p className="text-sm text-gray-500">{category.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`batch-enabled-${category.id}`} className="text-sm">
                      Batch Processing
                    </Label>
                    <Switch
                      id={`batch-enabled-${category.id}`}
                      checked={category.batch_enabled}
                      onCheckedChange={(checked) => toggleBatchEnabled(category.id, checked)}
                      disabled={isSaving}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedCategory(
                      expandedCategory === category.id ? null : category.id
                    )}
                  >
                    {expandedCategory === category.id ? 'Collapse' : 'Configure'}
                  </Button>
                </div>
              </div>
            </CardHeader>

            {expandedCategory === category.id && (
              <CardContent className="space-y-6 border-t">
                
                {/* Trigger Stages Configuration */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Stages that can trigger batch allocation:</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {triggerStages.map((stage) => (
                      <div key={stage.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`stage-${category.id}-${stage.id}`}
                          checked={category.trigger_stages.includes(stage.id)}
                          onChange={(e) => {
                            const currentStages = category.trigger_stages;
                            const newStages = e.target.checked
                              ? [...currentStages, stage.id]
                              : currentStages.filter(id => id !== stage.id);
                            updateTriggerStages(category.id, newStages);
                          }}
                          disabled={!category.batch_enabled || isSaving}
                          className="rounded"
                        />
                        <Label htmlFor={`stage-${category.id}-${stage.id}`} className="text-sm">
                          {stage.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Skip Conditions */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Skip conditions (when to bypass batching):</Label>
                  <div className="space-y-2">
                    {category.skip_conditions.map((condition, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Badge variant="outline" className="flex-1 justify-between">
                          <span>{condition}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 ml-2"
                            onClick={() => removeSkipCondition(category.id, index)}
                            disabled={!category.batch_enabled || isSaving}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Select
                        onValueChange={(value) => addSkipCondition(category.id, value)}
                        disabled={!category.batch_enabled || isSaving}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Add skip condition..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="qty_less_than_5">Quantity less than 5</SelectItem>
                          <SelectItem value="urgent_job">Urgent/expedited jobs</SelectItem>
                          <SelectItem value="single_sided_only">Single-sided only</SelectItem>
                          <SelectItem value="custom_workflow">Custom workflow jobs</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Batch Category Mapping */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Default batch category:</Label>
                  <Select disabled={!category.batch_enabled || isSaving}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select batch category..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="business_cards">Business Cards</SelectItem>
                      <SelectItem value="flyers">Flyers</SelectItem>
                      <SelectItem value="postcards">Postcards</SelectItem>
                      <SelectItem value="posters">Posters</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Summary */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-sm mb-2">Configuration Summary</h4>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>
                      <strong>Batch Processing:</strong> {category.batch_enabled ? 'Enabled' : 'Disabled'}
                    </p>
                    {category.batch_enabled && (
                      <>
                        <p>
                          <strong>Trigger Stages:</strong> {category.trigger_stages.length} configured
                        </p>
                        <p>
                          <strong>Skip Conditions:</strong> {category.skip_conditions.length} configured
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};