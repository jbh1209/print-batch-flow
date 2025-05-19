
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  FieldDefinition, 
  FieldType 
} from './types/ProductPageTypes';
import { Card } from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  PlusCircle, 
  Trash2, 
  ArrowUp, 
  ArrowDown,
  Layers
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface TemplateFormProps {
  initialData?: {
    name: string;
    description?: string;
    fields: FieldDefinition[];
  };
  onSubmit: (data: {
    name: string;
    description?: string;
    fields: FieldDefinition[];
  }) => void;
  isSaving: boolean;
}

export function TemplateForm({ initialData, onSubmit, isSaving }: TemplateFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [fields, setFields] = useState<FieldDefinition[]>(
    initialData?.fields || []
  );

  const addField = () => {
    const newField: FieldDefinition = {
      id: `field-${Date.now()}`,
      name: `field${fields.length + 1}`,
      type: 'text',
      required: false,
      label: `Field ${fields.length + 1}`,
    };
    setFields([...fields, newField]);
  };

  const updateField = (index: number, updates: Partial<FieldDefinition>) => {
    const updatedFields = [...fields];
    updatedFields[index] = { ...updatedFields[index], ...updates };

    // If name is updated, ensure it's valid for a property name (no spaces, special chars)
    if (updates.name) {
      updatedFields[index].name = updates.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    }

    setFields(updatedFields);
  };

  const removeField = (index: number) => {
    const updatedFields = [...fields];
    updatedFields.splice(index, 1);
    setFields(updatedFields);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === fields.length - 1)
    ) {
      return;
    }

    const updatedFields = [...fields];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    [updatedFields[index], updatedFields[newIndex]] = [updatedFields[newIndex], updatedFields[index]];
    setFields(updatedFields);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (name.trim() === '') {
      alert('Template name is required');
      return;
    }
    
    if (fields.length === 0) {
      alert('At least one field is required');
      return;
    }
    
    onSubmit({
      name,
      description,
      fields,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Template Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g., Product Specification Sheet"
          />
        </div>
        
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this template is used for"
            rows={3}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Fields</h3>
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={addField}
          >
            <PlusCircle className="h-4 w-4 mr-1" /> Add Field
          </Button>
        </div>
        
        {fields.length === 0 ? (
          <div className="text-center p-6 border border-dashed rounded-md">
            <Layers className="h-10 w-10 mx-auto text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">No fields added yet</p>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              className="mt-2" 
              onClick={addField}
            >
              Add Your First Field
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {fields.map((field, index) => (
              <Card key={field.id} className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-6 space-y-4">
                    <div>
                      <Label htmlFor={`field-label-${index}`}>Field Label</Label>
                      <Input
                        id={`field-label-${index}`}
                        value={field.label}
                        onChange={(e) => updateField(index, { label: e.target.value })}
                        placeholder="Display name"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor={`field-name-${index}`}>Field Name</Label>
                      <Input
                        id={`field-name-${index}`}
                        value={field.name}
                        onChange={(e) => updateField(index, { name: e.target.value })}
                        placeholder="Property name (no spaces)"
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Used as the property name in code
                      </p>
                    </div>
                  </div>
                  
                  <div className="md:col-span-4 space-y-4">
                    <div>
                      <Label htmlFor={`field-type-${index}`}>Field Type</Label>
                      <Select
                        value={field.type}
                        onValueChange={(value) => updateField(index, { type: value as FieldType })}
                      >
                        <SelectTrigger id={`field-type-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="textarea">Text Area</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="select">Dropdown</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="checkbox">Checkbox</SelectItem>
                          <SelectItem value="file">File Upload</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id={`field-required-${index}`}
                        checked={field.required}
                        onCheckedChange={(checked) =>
                          updateField(index, { required: checked })
                        }
                      />
                      <Label htmlFor={`field-required-${index}`}>Required</Label>
                    </div>
                  </div>
                  
                  <div className="md:col-span-2 flex md:flex-col justify-end items-center space-x-2 md:space-x-0 md:space-y-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon"
                      onClick={() => moveField(index, 'up')}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon"
                      onClick={() => moveField(index, 'down')}
                      disabled={index === fields.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button 
                      type="button" 
                      variant="destructive" 
                      size="icon" 
                      onClick={() => removeField(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {field.type === 'select' && (
                  <div className="mt-4">
                    <Label htmlFor={`field-options-${index}`}>Options (comma-separated)</Label>
                    <Input
                      id={`field-options-${index}`}
                      value={field.options?.join(', ') || ''}
                      onChange={(e) =>
                        updateField(index, {
                          options: e.target.value.split(',').map((option) => option.trim()),
                        })
                      }
                      placeholder="Option 1, Option 2, Option 3"
                    />
                  </div>
                )}
                
                {field.type === 'text' || field.type === 'textarea' || field.type === 'number' ? (
                  <div className="mt-4">
                    <Label htmlFor={`field-placeholder-${index}`}>Placeholder</Label>
                    <Input
                      id={`field-placeholder-${index}`}
                      value={field.placeholder || ''}
                      onChange={(e) =>
                        updateField(index, { placeholder: e.target.value })
                      }
                      placeholder="Placeholder text"
                    />
                  </div>
                ) : null}
                
                {field.type === 'number' && (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`field-min-${index}`}>Min Value</Label>
                      <Input
                        id={`field-min-${index}`}
                        type="number"
                        value={field.min || ''}
                        onChange={(e) =>
                          updateField(index, { min: parseInt(e.target.value) })
                        }
                        placeholder="Minimum"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`field-max-${index}`}>Max Value</Label>
                      <Input
                        id={`field-max-${index}`}
                        type="number"
                        value={field.max || ''}
                        onChange={(e) =>
                          updateField(index, { max: parseInt(e.target.value) })
                        }
                        placeholder="Maximum"
                      />
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : initialData ? 'Save Template' : 'Create Template'}
        </Button>
      </div>
    </form>
  );
}
