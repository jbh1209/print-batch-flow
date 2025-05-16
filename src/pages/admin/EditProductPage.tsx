
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Trash, PlusCircle, Move, Loader2 } from 'lucide-react';
import { DebugInfo } from '@/components/ui/debug-info';
import { generateRenderKey } from '@/utils/cacheUtils';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// Define field types
const FIELD_TYPES = [
  { id: 'text', name: 'Text Input' },
  { id: 'select', name: 'Dropdown Select' },
  { id: 'number', name: 'Number' },
  { id: 'boolean', name: 'Yes/No Toggle' },
];

// Form schema
const formSchema = z.object({
  productName: z.string().min(2, 'Product name must be at least 2 characters'),
  productSlug: z.string().min(2, 'Product slug must be at least 2 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  tableName: z.string().min(3, 'Table name must be at least 3 characters')
    .regex(/^[a-z0-9_]+$/, 'Table name must contain only lowercase letters, numbers, and underscores'),
  jobPrefix: z.string().min(1).max(5, 'Job prefix must be between 1-5 characters'),
  iconName: z.string().min(1, 'Icon name is required'),
  colorHex: z.string().regex(/^#[0-9A-F]{6}$/i, 'Must be a valid hex color'),
});

type ProductField = {
  id: string;
  field_name: string;
  field_type: string;
  is_required: boolean;
  options?: {
    id: string;
    option_value: string;
    display_name: string;
  }[];
};

const EditProductPage = () => {
  const { id } = useParams<{ id: string }>();
  const renderKey = generateRenderKey();
  const navigate = useNavigate();
  
  const [fields, setFields] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productName: '',
      productSlug: '',
      tableName: '',
      jobPrefix: '',
      iconName: 'CreditCard',
      colorHex: '#4F46E5',
    },
  });

  useEffect(() => {
    if (id) {
      fetchProductData(id);
    }
  }, [id]);

  const fetchProductData = async (productId: string) => {
    try {
      setIsLoading(true);
      
      // Fetch the product
      const { data: product, error: productError } = await supabase
        .from('product_types')
        .select('*')
        .eq('id', productId)
        .single();
      
      if (productError) throw productError;
      
      if (!product) {
        toast.error('Product not found');
        navigate('/admin/products');
        return;
      }
      
      // Set form values
      form.setValue('productName', product.name);
      form.setValue('productSlug', product.slug);
      form.setValue('tableName', product.table_name);
      form.setValue('jobPrefix', product.job_prefix);
      form.setValue('iconName', product.icon_name || 'CreditCard');
      form.setValue('colorHex', product.color || '#4F46E5');
      
      // Fetch fields
      const { data: fieldsData, error: fieldsError } = await supabase
        .from('product_fields')
        .select('*')
        .eq('product_type_id', productId);
      
      if (fieldsError) throw fieldsError;
      
      if (fieldsData && fieldsData.length > 0) {
        // Build array for field options
        const fieldsWithOptions = await Promise.all(
          fieldsData.map(async (field) => {
            if (field.field_type === 'select') {
              // Fetch options for this field
              const { data: options, error: optionsError } = await supabase
                .from('product_field_options')
                .select('*')
                .eq('product_field_id', field.id);
              
              if (optionsError) throw optionsError;
              
              return {
                ...field,
                id: field.id,
                name: field.field_name,
                type: field.field_type,
                required: field.is_required,
                options: options?.map(opt => ({
                  value: opt.option_value,
                  label: opt.display_name,
                  id: opt.id
                })) || []
              };
            }
            
            return {
              ...field,
              id: field.id,
              name: field.field_name,
              type: field.field_type,
              required: field.is_required,
              options: []
            };
          })
        );
        
        setFields(fieldsWithOptions);
      }
      
    } catch (error: any) {
      toast.error(`Failed to load product: ${error.message}`);
      console.error('Error loading product:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add a new field
  const addField = () => {
    setFields([
      ...fields,
      {
        id: generateRenderKey(),
        name: '',
        type: 'text',
        required: false,
        options: [],
        isNew: true
      },
    ]);
  };

  // Remove a field
  const removeField = async (index: number) => {
    const field = fields[index];
    
    // If it's an existing field, delete it from the database
    if (!field.isNew && field.id) {
      try {
        // First delete any options
        if (field.options && field.options.length > 0) {
          const { error: optionsError } = await supabase
            .from('product_field_options')
            .delete()
            .eq('product_field_id', field.id);
          
          if (optionsError) throw optionsError;
        }
        
        // Then delete the field
        const { error: fieldError } = await supabase
          .from('product_fields')
          .delete()
          .eq('id', field.id);
        
        if (fieldError) throw fieldError;
        
        toast.success('Field deleted successfully');
      } catch (error: any) {
        toast.error(`Failed to delete field: ${error.message}`);
        console.error('Error deleting field:', error);
        return;
      }
    }
    
    // Update state
    const updatedFields = [...fields];
    updatedFields.splice(index, 1);
    setFields(updatedFields);
  };

  // Update a field
  const updateField = (index: number, key: string, value: any) => {
    const updatedFields = [...fields];
    updatedFields[index] = { ...updatedFields[index], [key]: value };
    
    // Initialize options array if this is a select field
    if (key === 'type' && value === 'select' && (!updatedFields[index].options || !updatedFields[index].options.length)) {
      updatedFields[index].options = [{ value: '', label: '' }];
    }
    
    setFields(updatedFields);
  };

  // Add a new option to a select field
  const addOption = (fieldIndex: number) => {
    const updatedFields = [...fields];
    if (!updatedFields[fieldIndex].options) {
      updatedFields[fieldIndex].options = [];
    }
    updatedFields[fieldIndex].options.push({ value: '', label: '', isNew: true });
    setFields(updatedFields);
  };

  // Update an option
  const updateOption = (fieldIndex: number, optionIndex: number, key: string, value: string) => {
    const updatedFields = [...fields];
    updatedFields[fieldIndex].options[optionIndex] = {
      ...updatedFields[fieldIndex].options[optionIndex],
      [key]: value,
    };
    setFields(updatedFields);
  };

  // Remove an option
  const removeOption = async (fieldIndex: number, optionIndex: number) => {
    const option = fields[fieldIndex].options[optionIndex];
    
    // If it's an existing option, delete it from the database
    if (!option.isNew && option.id) {
      try {
        const { error } = await supabase
          .from('product_field_options')
          .delete()
          .eq('id', option.id);
        
        if (error) throw error;
      } catch (error: any) {
        toast.error(`Failed to delete option: ${error.message}`);
        console.error('Error deleting option:', error);
        return;
      }
    }
    
    // Update state
    const updatedFields = [...fields];
    updatedFields[fieldIndex].options.splice(optionIndex, 1);
    setFields(updatedFields);
  };

  // Handle form submission
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!id) {
      toast.error('Product ID is missing');
      return;
    }
    
    // Validate all fields have proper values
    const fieldErrors = [];
    
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      
      // Check field name and type
      if (!field.name || !field.type) {
        fieldErrors.push(`Field #${i + 1} is missing a name or type`);
        continue;
      }
      
      // Check options for select fields
      if (field.type === 'select' && (!field.options || field.options.length === 0)) {
        fieldErrors.push(`Select field "${field.name}" must have at least one option`);
        continue;
      }
      
      if (field.type === 'select') {
        for (let j = 0; j < field.options.length; j++) {
          const option = field.options[j];
          if (!option.value || !option.label) {
            fieldErrors.push(`Option #${j + 1} in field "${field.name}" is missing a value or label`);
          }
        }
      }
    }
    
    if (fieldErrors.length > 0) {
      fieldErrors.forEach(error => toast.error(error));
      return;
    }

    // Update the product
    setIsSubmitting(true);
    try {
      // 1. Update the product type
      const { error: productError } = await supabase
        .from('product_types')
        .update({
          name: values.productName,
          slug: values.productSlug,
          table_name: values.tableName,
          job_prefix: values.jobPrefix,
          icon_name: values.iconName,
          color: values.colorHex,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (productError) {
        throw new Error(`Failed to update product: ${productError.message}`);
      }

      // 2. Process fields
      for (const field of fields) {
        // If it's a new field, create it
        if (field.isNew) {
          const { data: fieldData, error: fieldError } = await supabase
            .from('product_fields')
            .insert({
              product_type_id: id,
              field_name: field.name,
              field_type: field.type,
              is_required: field.required
            })
            .select()
            .single();

          if (fieldError) {
            throw new Error(`Failed to create field ${field.name}: ${fieldError.message}`);
          }

          // Insert options for new select fields
          if (field.type === 'select' && field.options && field.options.length > 0) {
            const optionsToInsert = field.options.map((option: any) => ({
              product_field_id: fieldData.id,
              option_value: option.value,
              display_name: option.label
            }));

            const { error: optionsError } = await supabase
              .from('product_field_options')
              .insert(optionsToInsert);

            if (optionsError) {
              throw new Error(`Failed to create options for field ${field.name}: ${optionsError.message}`);
            }
          }
        } else {
          // Update existing field
          const { error: fieldError } = await supabase
            .from('product_fields')
            .update({
              field_name: field.name,
              field_type: field.type,
              is_required: field.required,
              updated_at: new Date().toISOString()
            })
            .eq('id', field.id);

          if (fieldError) {
            throw new Error(`Failed to update field ${field.name}: ${fieldError.message}`);
          }

          // Handle options for select fields
          if (field.type === 'select' && field.options && field.options.length > 0) {
            for (const option of field.options) {
              // If it's a new option, create it
              if (option.isNew) {
                const { error: optionError } = await supabase
                  .from('product_field_options')
                  .insert({
                    product_field_id: field.id,
                    option_value: option.value,
                    display_name: option.label
                  });

                if (optionError) {
                  throw new Error(`Failed to create option for field ${field.name}: ${optionError.message}`);
                }
              } else if (option.id) {
                // Update existing option
                const { error: optionError } = await supabase
                  .from('product_field_options')
                  .update({
                    option_value: option.value,
                    display_name: option.label,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', option.id);

                if (optionError) {
                  throw new Error(`Failed to update option for field ${field.name}: ${optionError.message}`);
                }
              }
            }
          }
        }
      }

      // Success
      toast.success('Product updated successfully!');
      navigate('/admin/products');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update product');
      console.error('Product update error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="flex flex-col items-center gap-2">
          <Loader2 size={40} className="animate-spin text-primary" />
          <p className="text-gray-500">Loading product data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Edit Product</h1>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Product Information</CardTitle>
              <CardDescription>
                Basic information about the product
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="productName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Business Cards" {...field} />
                      </FormControl>
                      <FormDescription>
                        The display name for this product
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="productSlug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Slug</FormLabel>
                      <FormControl>
                        <Input placeholder="business-cards" {...field} />
                      </FormControl>
                      <FormDescription>
                        URL-friendly name (lowercase, hyphens)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tableName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Database Table Name</FormLabel>
                      <FormControl>
                        <Input placeholder="business_card_jobs" {...field} disabled />
                      </FormControl>
                      <FormDescription>
                        Table name cannot be changed after creation
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="jobPrefix"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Number Prefix</FormLabel>
                      <FormControl>
                        <Input placeholder="BC" {...field} />
                      </FormControl>
                      <FormDescription>
                        Short code for job numbers (e.g., BC for Business Cards)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="iconName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Icon Name</FormLabel>
                      <FormControl>
                        <Input placeholder="CreditCard" {...field} />
                      </FormControl>
                      <FormDescription>
                        Lucide icon name (e.g., CreditCard, FileText)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="colorHex"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand Color</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input type="text" placeholder="#4F46E5" {...field} />
                        </FormControl>
                        <input 
                          type="color" 
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="w-10 h-10 rounded"
                        />
                      </div>
                      <FormDescription>
                        Hex color code for the product
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Product Fields</CardTitle>
              <CardDescription>
                Define the fields that will be available for this product
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {fields.length === 0 ? (
                  <div className="text-center p-8 border border-dashed rounded-md">
                    <p className="text-gray-500">No fields added yet. Click the button below to add fields.</p>
                  </div>
                ) : (
                  fields.map((field, index) => (
                    <div key={field.id} className="border rounded-md p-4">
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                          <Move className="text-gray-400" size={18} />
                          <h3 className="font-semibold">Field #{index + 1}</h3>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeField(index)}
                          type="button"
                        >
                          <Trash size={16} className="text-red-500" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Field Name */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Field Name</label>
                          <Input 
                            value={field.name} 
                            onChange={(e) => updateField(index, 'name', e.target.value)}
                            placeholder="paper_type"
                            disabled={!field.isNew && field.id} // Disable editing for existing fields
                          />
                          <p className="text-xs text-gray-500">
                            {field.isNew 
                              ? 'Database column name (snake_case)'
                              : 'Field name cannot be changed after creation'}
                          </p>
                        </div>
                        
                        {/* Field Type */}
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Field Type</label>
                          <Select 
                            value={field.type} 
                            onValueChange={(value) => updateField(index, 'type', value)}
                            disabled={!field.isNew && field.id} // Disable editing for existing fields
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {FIELD_TYPES.map(type => (
                                <SelectItem key={type.id} value={type.id}>
                                  {type.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-gray-500">
                            {field.isNew 
                              ? 'Type of input for this field'
                              : 'Field type cannot be changed after creation'}
                          </p>
                        </div>
                        
                        {/* Required Field */}
                        <div className="flex items-center space-x-2 h-10">
                          <input
                            type="checkbox"
                            id={`required-${field.id}`}
                            checked={field.required}
                            onChange={(e) => updateField(index, 'required', e.target.checked)}
                            className="rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <label htmlFor={`required-${field.id}`} className="text-sm font-medium">
                            Required Field
                          </label>
                        </div>
                      </div>
                      
                      {/* Options for select fields */}
                      {field.type === 'select' && (
                        <div className="mt-4 border-t pt-4">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-medium">Options</h4>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addOption(index)}
                            >
                              <PlusCircle size={14} className="mr-1" /> Add Option
                            </Button>
                          </div>
                          
                          {field.options && field.options.length > 0 ? (
                            <div className="space-y-2">
                              {field.options.map((option: any, optionIndex: number) => (
                                <div key={option.id || optionIndex} className="flex gap-2 items-center">
                                  <Input
                                    value={option.value}
                                    onChange={(e) => updateOption(index, optionIndex, 'value', e.target.value)}
                                    placeholder="Value (e.g. matt)"
                                    className="flex-1"
                                  />
                                  <Input
                                    value={option.label}
                                    onChange={(e) => updateOption(index, optionIndex, 'label', e.target.value)}
                                    placeholder="Label (e.g. Matt)"
                                    className="flex-1"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeOption(index, optionIndex)}
                                  >
                                    <Trash size={16} className="text-red-500" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">
                              No options added yet. Click "Add Option" to create options.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={addField}
                  className="w-full"
                >
                  <PlusCircle size={16} className="mr-2" /> Add New Field
                </Button>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => navigate('/admin/products')}
                type="button"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || fields.length === 0}
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>

      <DebugInfo
        componentName="EditProductPage"
        extraInfo={{ 
          fields, 
          formValues: form.watch(), 
          renderKey,
          productId: id
        }}
      />
    </div>
  );
};

export default EditProductPage;
