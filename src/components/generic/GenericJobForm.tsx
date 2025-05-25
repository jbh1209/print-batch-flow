
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { ArrowLeft } from "lucide-react";
import { useFileUpload } from "@/hooks/useFileUpload";
import FormActions from "@/components/business-cards/FormActions";
import { createJobFormSchema, getDefaultFormValues, GenericJobFormValues } from "@/lib/schema/genericJobFormSchema";
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

  const formSchema = createJobFormSchema(config);
  const defaultValues = getDefaultFormValues(config);

  const form = useForm<GenericJobFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues
  });

  // Reset form with proper data when initialData changes
  useEffect(() => {
    if (initialData && mode === 'edit') {
      console.log(`Resetting ${config.tableName} form with data:`, initialData);
      const resetData: any = {
        name: initialData.name,
        job_number: initialData.job_number,
        quantity: initialData.quantity,
        due_date: new Date(initialData.due_date)
      };

      // Add optional fields if they exist
      if (initialData.size) resetData.size = initialData.size;
      if (initialData.paper_type) resetData.paper_type = initialData.paper_type;
      if (initialData.paper_weight) resetData.paper_weight = initialData.paper_weight;
      if (initialData.lamination_type) resetData.lamination_type = initialData.lamination_type;
      if (initialData.uv_varnish) resetData.uv_varnish = initialData.uv_varnish;
      if (initialData.sides) resetData.sides = initialData.sides;

      console.log(`Reset data for ${config.tableName}:`, resetData);
      form.reset(resetData);
    }
  }, [initialData, form, mode, config.tableName]);

  useEffect(() => {
    if (selectedFile) {
      form.setValue("file", selectedFile, { shouldValidate: true });
    } else if (mode === 'create') {
      form.setValue("file", undefined as any, { shouldValidate: false });
    }
  }, [selectedFile, form, mode]);

  const onSubmit = async (data: GenericJobFormValues) => {
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
