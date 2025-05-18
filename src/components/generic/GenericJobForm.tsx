
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { ArrowLeft } from "lucide-react";
import { useFileUpload } from "@/hooks/useFileUpload";
import FormActions from "@/components/business-cards/FormActions";
import { createGenericJobFormSchema, getDefaultFormValues, GenericJobFormValues } from "@/lib/schema/genericJobFormSchema";
import { ProductConfig, BaseJob } from "@/config/productTypes";
import { useGenericJobSubmit } from "@/hooks/generic/useGenericJobSubmit";
import { GenericJobFormFields } from "./forms/GenericJobFormFields";

interface GenericJobFormProps {
  config: ProductConfig;
  mode?: 'create' | 'edit';
  initialData?: BaseJob;
}

export const GenericJobForm = ({ 
  config,
  mode = 'create',
  initialData
}: GenericJobFormProps) => {
  const navigate = useNavigate();
  const { handleSubmit, isSubmitting } = useGenericJobSubmit(config);
  
  const { 
    selectedFile, 
    setSelectedFile, 
    handleFileChange
  } = useFileUpload({
    acceptedTypes: ['application/pdf'],
    maxSizeInMB: 10
  });

  // Create form schema based on product configuration
  const formSchema = createGenericJobFormSchema(config);
  
  // Get default values based on product configuration or initial data
  const defaultValues = initialData ? {
    name: initialData.name,
    job_number: initialData.job_number,
    quantity: initialData.quantity,
    due_date: new Date(initialData.due_date),
    ...(initialData.size !== undefined && { size: initialData.size }),
    ...(initialData.paper_type !== undefined && { paper_type: initialData.paper_type }),
    ...(initialData.paper_weight !== undefined && { paper_weight: initialData.paper_weight })
  } : getDefaultFormValues(config);

  const form = useForm<GenericJobFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues
  });

  useEffect(() => {
    if (selectedFile) {
      form.setValue("file", selectedFile, { shouldValidate: true });
    } else if (mode === 'create') {
      // Only clear the file field if we're creating (required for new jobs)
      form.setValue("file", undefined as any, { shouldValidate: false });
    }
  }, [selectedFile, form, mode]);

  const onSubmit = async (data: GenericJobFormValues) => {
    // Pass the job ID if we're in edit mode
    await handleSubmit(data, selectedFile, mode === 'edit' ? initialData?.id : undefined);
  };

  return (
    <div>
      <div className="flex items-center mb-6">
        <Button 
          variant="outline" 
          size="sm" 
          className="mr-4"
          onClick={() => navigate(config.routes.jobsPath)}
        >
          <ArrowLeft size={16} className="mr-1" /> Back to Jobs
        </Button>
        <h2 className="text-xl font-semibold">
          {mode === 'create' ? `Create New ${config.ui.jobFormTitle}` : 
           `Edit ${config.ui.jobFormTitle}`}
        </h2>
      </div>

      <FormProvider {...form}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl bg-white p-6 rounded-lg shadow">
            <GenericJobFormFields 
              config={config}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              handleFileChange={handleFileChange}
              isEdit={mode === 'edit'}
            />

            <FormActions 
              isSubmitting={isSubmitting}
              submitLabel={mode === 'create' ? 'Create Job' : 'Save Changes'}
              cancelPath={config.routes.jobsPath}
            />
          </form>
        </Form>
      </FormProvider>
    </div>
  );
};
