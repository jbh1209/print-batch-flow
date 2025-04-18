
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { ArrowLeft } from "lucide-react";
import { useFileUpload } from "@/hooks/useFileUpload";
import { FlyerJobFormFields } from "./components/FlyerJobFormFields";
import { useFlyerJobSubmit } from "./hooks/useFlyerJobSubmit";
import { flyerJobFormSchema, type FlyerJobFormValues } from "./schema/flyerJobFormSchema";
import { FlyerJob } from "../batches/types/FlyerTypes";
import FormActions from "../business-cards/FormActions";

interface FlyerJobFormProps {
  mode?: 'create' | 'edit';
  initialData?: FlyerJob;
}

export const FlyerJobForm = ({ mode = 'create', initialData }: FlyerJobFormProps) => {
  const navigate = useNavigate();
  const { handleSubmit, isSubmitting } = useFlyerJobSubmit();
  
  const { 
    selectedFile, 
    setSelectedFile, 
    handleFileChange
  } = useFileUpload({
    acceptedTypes: ['application/pdf'],
    maxSizeInMB: 10
  });

  const form = useForm<FlyerJobFormValues>({
    resolver: zodResolver(flyerJobFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      job_number: initialData?.job_number || "",
      size: initialData?.size || "A4",
      paper_weight: initialData?.paper_weight || "115gsm",
      paper_type: initialData?.paper_type || "Matt",
      quantity: initialData?.quantity || 0,
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

  const onSubmit = async (data: FlyerJobFormValues) => {
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
          onClick={() => navigate("/batches/flyers/jobs")}
        >
          <ArrowLeft size={16} className="mr-1" /> Back to Jobs
        </Button>
        <h2 className="text-xl font-semibold">
          {mode === 'create' ? 'Create New Flyer Job' : 'Edit Flyer Job'}
        </h2>
      </div>

      <FormProvider {...form}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl bg-white p-6 rounded-lg shadow">
            <FlyerJobFormFields 
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              handleFileChange={handleFileChange}
              isEdit={mode === 'edit'}
            />

            <FormActions 
              isSubmitting={isSubmitting}
              submitLabel={mode === 'create' ? 'Create Job' : 'Save Changes'}
              cancelPath="/batches/flyers/jobs"
            />
          </form>
        </Form>
      </FormProvider>
    </div>
  );
};
