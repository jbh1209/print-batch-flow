
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FieldDefinition, ProductPageTemplate, PRODUCT_PAGE_TEMPLATES_TABLE } from '@/components/product-pages/types/ProductPageTypes';
import { useAuth } from '@/hooks/useAuth';

export interface TemplateFormValues {
  name: string;
  description?: string;
  fields: FieldDefinition[];
}

export function useProductPageTemplates() {
  const [templates, setTemplates] = useState<ProductPageTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { user } = useAuth();

  // Fetch all templates
  const fetchTemplates = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from(PRODUCT_PAGE_TEMPLATES_TABLE)
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Transform the JSON fields to typed FieldDefinition arrays
      const typedTemplates = (data || []).map(template => ({
        ...template,
        fields: template.fields as unknown as FieldDefinition[]
      })) as ProductPageTemplate[];

      setTemplates(typedTemplates);
    } catch (err) {
      console.error('Error fetching product page templates:', err);
      setError('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  // Create a new template
  const createTemplate = async (templateData: TemplateFormValues) => {
    if (!user) {
      toast.error('You must be logged in to create templates');
      return null;
    }

    try {
      setIsSaving(true);
      
      const newTemplate = {
        name: templateData.name,
        description: templateData.description || '',
        fields: templateData.fields,
        created_by: user.id
      };

      // Convert fields to JSON before sending to Supabase
      const { data, error } = await supabase
        .from(PRODUCT_PAGE_TEMPLATES_TABLE)
        .insert([{
          ...newTemplate,
          fields: JSON.parse(JSON.stringify(newTemplate.fields)) // Convert to JSON compatible format
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success('Template created successfully');
      
      // Ensure proper typing for the template
      const typedTemplate = {
        ...data,
        fields: data.fields as unknown as FieldDefinition[]
      } as ProductPageTemplate;
      
      setTemplates(prevTemplates => [typedTemplate, ...prevTemplates]);
      return typedTemplate;
    } catch (err) {
      console.error('Error creating template:', err);
      toast.error('Failed to create template');
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  // Update an existing template
  const updateTemplate = async (templateId: string, templateData: TemplateFormValues) => {
    if (!user) {
      toast.error('You must be logged in to update templates');
      return false;
    }

    try {
      setIsSaving(true);
      
      // Convert fields to JSON before sending to Supabase
      const updatedTemplateData = {
        name: templateData.name,
        description: templateData.description || '',
        fields: JSON.parse(JSON.stringify(templateData.fields)), // Convert to JSON compatible format
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from(PRODUCT_PAGE_TEMPLATES_TABLE)
        .update(updatedTemplateData)
        .eq('id', templateId);

      if (error) throw error;

      toast.success('Template updated successfully');
      
      setTemplates(prevTemplates => 
        prevTemplates.map(template => 
          template.id === templateId 
            ? { 
                ...template, 
                ...templateData,
                updated_at: updatedTemplateData.updated_at
              } 
            : template
        )
      );
      return true;
    } catch (err) {
      console.error('Error updating template:', err);
      toast.error('Failed to update template');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Delete a template
  const deleteTemplate = async (templateId: string) => {
    if (!user) {
      toast.error('You must be logged in to delete templates');
      return false;
    }

    try {
      setIsDeleting(true);
      
      const { error } = await supabase
        .from(PRODUCT_PAGE_TEMPLATES_TABLE)
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast.success('Template deleted successfully');
      setTemplates(prevTemplates => prevTemplates.filter(t => t.id !== templateId));
      return true;
    } catch (err) {
      console.error('Error deleting template:', err);
      toast.error('Failed to delete template');
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  // Get a single template by ID
  const getTemplateById = (templateId: string): ProductPageTemplate | undefined => {
    return templates.find(t => t.id === templateId);
  };

  // Load templates when component mounts
  useEffect(() => {
    fetchTemplates();
  }, [user]);

  return {
    templates,
    isLoading,
    error,
    isSaving,
    isDeleting,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplateById
  };
}
