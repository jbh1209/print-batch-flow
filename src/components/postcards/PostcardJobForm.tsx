
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { useFileUpload } from "@/hooks/useFileUpload";
import { usePostcardJobOperations } from "@/hooks/usePostcardJobOperations";
import { postCardJobFormSchema, type PostcardJobFormValues } from "./schema/postcardJobFormSchema";
import { PostcardJob } from "../batches/types/PostcardTypes";
import FormActions from "../business-cards/FormActions";
import { PostcardJobFormFields } from "./components/PostcardJobFormFields";
import { toast } from "sonner";

interface PostcardJobFormProps {
  mode?: 'create' | 'edit';
  initialData?: PostcardJob;
}

export const PostcardJobForm = ({ mode = 'create', initialData }: PostcardJobFormProps) => {
  const navigate = useNavigate();
  const { createJob, isSubmitting } = usePostcardJobOperations();
  
  const { 
    selectedFile, 
    setSelectedFile, 
    handleFileChange
  } = useFileUpload({
    acceptedTypes: ['application/pdf'],
    maxSizeInMB: 10
  });

  const form = useForm<PostcardJobFormValues>({
    resolver: zodResolver(postCardJobFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      job_number: initialData?.job_number || "",
      size: "A6",
      paper_type: initialData?.paper_type || "350gsm Matt",
      lamination_type: initialData?.lamination_type || "none",
      quantity: initialData?.quantity || 0,
      due_date: initialData ? new Date(initialData.due_date) : new Date()
    }
  });

  useEffect(() => {
    if (selectedFile) {
      form.setValue("file", selectedFile, { shouldValidate: true });
    } else if (mode === 'create') {
      form.setValue("file", undefined as any, { shouldValidate: false });
    }
  }, [selectedFile, form, mode]);

  const handleSubmit = async (data: PostcardJobFormValues) => {
    try {
      if (!selectedFile && mode === 'create') {
        toast.error('Please upload a PDF file');
        return;
      }

      const jobData = {
        name: data.name,
        job_number: data.job_number,
        size: data.size,
        paper_type: data.paper_type,
        paper_weight: data.paper_type.match(/(\d+gsm)/)?.[0] || "350gsm", // Extract the weight from paper type
        lamination_type: data.lamination_type,
        quantity: data.quantity,
        due_date: data.due_date.toISOString(),
        pdf_url: initialData?.pdf_url || "", // Will be set by createJob after file upload
        file_name: selectedFile?.name || initialData?.file_name || "",
        file: selectedFile // Pass the file to be uploaded
      };

      await createJob(jobData);
      navigate("/batches/postcards/jobs");
      
    } catch (error) {
      console.error("Error submitting job:", error);
      toast.error("Failed to save job");
    }
  };

  return (
    <div>
      <FormProvider {...form}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 max-w-2xl bg-white p-6 rounded-lg shadow">
            <PostcardJobFormFields 
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              handleFileChange={handleFileChange}
              isEdit={mode === 'edit'}
            />

            <FormActions 
              isSubmitting={isSubmitting}
              submitLabel={mode === 'create' ? 'Create Job' : 'Save Changes'}
              cancelPath="/batches/postcards/jobs"
            />
          </form>
        </Form>
      </FormProvider>
    </div>
  );
};
