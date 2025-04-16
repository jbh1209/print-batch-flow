
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { ArrowLeft, Save } from "lucide-react";
import { useFileUpload } from "@/hooks/useFileUpload";
import { FlyerJobFormFields } from "./components/FlyerJobFormFields";
import { useFlyerJobSubmit } from "./hooks/useFlyerJobSubmit";
import { flyerJobFormSchema, type FlyerJobFormValues } from "./schema/flyerJobFormSchema";

export const FlyerJobForm = () => {
  const navigate = useNavigate();
  const { handleSubmit, isSubmitting } = useFlyerJobSubmit();
  
  // Initialize the file upload hook
  const { 
    selectedFile, 
    setSelectedFile, 
    handleFileChange
  } = useFileUpload({
    acceptedTypes: ['application/pdf'],
    maxSizeInMB: 10
  });

  // Initialize react-hook-form with zod validation
  const form = useForm<FlyerJobFormValues>({
    resolver: zodResolver(flyerJobFormSchema),
    defaultValues: {
      name: "",
      job_number: "",
      size: "A4",
      paper_weight: "115gsm",
      paper_type: "Matt",
      quantity: 0,
      due_date: new Date()
    }
  });

  // Update form value when file is selected
  useEffect(() => {
    if (selectedFile) {
      form.setValue("file", selectedFile, { shouldValidate: true });
    } else {
      form.setValue("file", undefined as any, { shouldValidate: false });
    }
  }, [selectedFile, form]);

  const onSubmit = async (data: FlyerJobFormValues) => {
    await handleSubmit(data, selectedFile!);
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
        <h2 className="text-xl font-semibold">Create New Flyer Job</h2>
      </div>

      <FormProvider {...form}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl bg-white p-6 rounded-lg shadow">
            <FlyerJobFormFields 
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              handleFileChange={handleFileChange}
            />

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/batches/flyers/jobs")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Saving...
                  </div>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Job
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </FormProvider>
    </div>
  );
};
