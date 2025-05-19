
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { ArrowLeft } from "lucide-react";
import { useFileUpload } from "@/hooks/useFileUpload";
import { ProductPageFormFields } from "./components/ProductPageFormFields";
import { useProductPageJobs } from "@/hooks/product-pages/useProductPageJobs";
import { useProductPageTemplates } from "@/hooks/product-pages/useProductPageTemplates";
import { FieldDefinition, ProductPageJob } from "./types/ProductPageTypes";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface ProductPageJobFormProps {
  mode?: 'create' | 'edit';
  initialData?: ProductPageJob;
}

export const ProductPageJobForm = ({ mode = 'create', initialData }: ProductPageJobFormProps) => {
  const navigate = useNavigate();
  const { createJob, isSubmitting } = useProductPageJobs();
  const { templates, isLoading: isLoadingTemplates } = useProductPageTemplates();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(initialData?.template_id || null);
  
  const { 
    selectedFile, 
    setSelectedFile, 
    handleFileChange
  } = useFileUpload({
    acceptedTypes: ['application/pdf'],
    maxSizeInMB: 10
  });

  // Dynamically build the form schema based on the selected template
  const buildFormSchema = (fields: FieldDefinition[]) => {
    const schemaObj: Record<string, any> = {
      name: z.string().min(1, "Name is required"),
      job_number: z.string().min(1, "Job number is required"),
      template_id: z.string().min(1, "Template is required"),
      quantity: z.number().int().positive("Quantity must be a positive number"),
      due_date: z.date(),
    };

    if (mode === 'create') {
      schemaObj.file = z.instanceof(File, { message: "PDF file is required" });
    }

    // Add custom fields to schema
    const customFieldsObj: Record<string, any> = {};
    fields.forEach(field => {
      let fieldSchema;
      
      switch (field.type) {
        case 'text':
        case 'textarea':
          fieldSchema = z.string();
          if (field.required) fieldSchema = fieldSchema.min(1, `${field.label} is required`);
          break;
        
        case 'number':
          fieldSchema = z.number();
          if (field.min !== undefined) fieldSchema = fieldSchema.min(field.min);
          if (field.max !== undefined) fieldSchema = fieldSchema.max(field.max);
          if (field.required) fieldSchema = fieldSchema.refine(val => val !== undefined, `${field.label} is required`);
          break;
        
        case 'checkbox':
          fieldSchema = z.boolean();
          break;
        
        case 'date':
          fieldSchema = z.date();
          if (field.required) fieldSchema = fieldSchema.refine(val => val !== undefined, `${field.label} is required`);
          break;
        
        case 'select':
          fieldSchema = z.string();
          if (field.required) fieldSchema = fieldSchema.min(1, `${field.label} is required`);
          break;

        default:
          fieldSchema = z.any();
      }
      
      customFieldsObj[field.name] = field.required ? fieldSchema : fieldSchema.optional();
    });

    schemaObj.custom_fields = z.object(customFieldsObj);
    
    return z.object(schemaObj);
  };

  // Get the currently selected template
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  
  // Build the form schema based on the selected template
  const formSchema = buildFormSchema(selectedTemplate?.fields || []);
  type FormValues = z.infer<typeof formSchema>;
  
  // Create form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      job_number: initialData?.job_number || "",
      template_id: initialData?.template_id || "",
      quantity: initialData?.quantity || 1,
      due_date: initialData ? new Date(initialData.due_date) : new Date(),
      custom_fields: initialData?.custom_fields || {}
    }
  });

  // Update form when template changes
  useEffect(() => {
    if (selectedTemplateId) {
      form.setValue("template_id", selectedTemplateId);
    }
  }, [selectedTemplateId, form]);

  useEffect(() => {
    if (selectedFile) {
      form.setValue("file", selectedFile, { shouldValidate: true });
    } else if (mode === 'create') {
      form.setValue("file", undefined as any, { shouldValidate: false });
    }
  }, [selectedFile, form, mode]);

  const onSubmit = async (data: FormValues) => {
    try {
      const result = await createJob(data, selectedFile);
      if (result) {
        toast.success("Job created successfully");
        navigate("/admin/product-pages/jobs");
      }
    } catch (err) {
      toast.error("Failed to create job");
      console.error(err);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    
    // Reset custom fields when template changes
    form.setValue("custom_fields", {});
  };

  if (isLoadingTemplates) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center mb-6">
        <Button 
          variant="outline" 
          size="sm" 
          className="mr-4"
          onClick={() => navigate("/admin/product-pages/jobs")}
        >
          <ArrowLeft size={16} className="mr-1" /> Back to Jobs
        </Button>
        <h2 className="text-xl font-semibold">
          {mode === 'create' ? 'Create New Product Page Job' : 'Edit Product Page Job'}
        </h2>
      </div>

      <FormProvider {...form}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl bg-white p-6 rounded-lg shadow">
            <ProductPageFormFields 
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              handleFileChange={handleFileChange}
              isEdit={mode === 'edit'}
              templates={templates}
              selectedTemplateId={selectedTemplateId}
              onTemplateChange={handleTemplateChange}
            />

            <div className="flex justify-end space-x-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate("/admin/product-pages/jobs")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : mode === 'create' ? 'Create Job' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Form>
      </FormProvider>
    </div>
  );
};
