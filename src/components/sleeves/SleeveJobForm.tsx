
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { ArrowLeft } from "lucide-react";
import { useFileUpload } from "@/hooks/useFileUpload";
import FormActions from "@/components/business-cards/FormActions";
import { sleeveJobFormSchema, SleeveJobFormValues } from "@/lib/schema/sleeveJobFormSchema";
import { useGenericJobSubmit } from "@/hooks/generic/useGenericJobSubmit";
import { productConfigs } from "@/config/productTypes";
import { SleeveJobFormFields } from "./SleeveJobFormFields";

interface SleeveJobFormProps {
  mode?: 'create' | 'edit';
  initialData?: any;
}

export const SleeveJobForm = ({ mode = 'create', initialData }: SleeveJobFormProps) => {
  const navigate = useNavigate();
  const config = productConfigs["Sleeves"];
  const { handleSubmit, isSubmitting } = useGenericJobSubmit(config);
  
  const { 
    selectedFile, 
    setSelectedFile, 
    handleFileChange
  } = useFileUpload({
    acceptedTypes: ['application/pdf'],
    maxSizeInMB: 10
  });

  const form = useForm<SleeveJobFormValues>({
    resolver: zodResolver(sleeveJobFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      job_number: initialData?.job_number || "",
      quantity: initialData?.quantity || 100,
      stock_type: initialData?.stock_type || "White",
      single_sided: initialData?.single_sided !== undefined ? initialData.single_sided : true,
      due_date: initialData ? new Date(initialData.due_date) : new Date()
    }
  });

  useEffect(() => {
    if (selectedFile) {
      form.setValue("file", selectedFile, { shouldValidate: true });
    } else if (mode === 'create') {
      // Only clear the file field if we're creating (required for new jobs)
      form.setValue("file", undefined as any, { shouldValidate: false });
    }
  }, [selectedFile, form, mode]);

  const onSubmit = async (data: SleeveJobFormValues) => {
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
          {mode === 'create' ? "Create New Sleeve Job" : "Edit Sleeve Job"}
        </h2>
      </div>

      <FormProvider {...form}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl bg-white p-6 rounded-lg shadow">
            <SleeveJobFormFields 
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
