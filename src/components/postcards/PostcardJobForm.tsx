
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { useFileUpload } from "@/hooks/useFileUpload";
import { postCardJobFormSchema, type PostcardJobFormValues } from "./schema/postcardJobFormSchema";
import FormActions from "../business-cards/FormActions";
import { PostcardJobFormFields } from "./components/PostcardJobFormFields";
import { usePostcardJobSubmit } from "@/hooks/usePostcardJobSubmit";

interface PostcardJobFormProps {
  mode?: 'create' | 'edit';
  initialData?: any;
}

export const PostcardJobForm = ({ mode = 'create', initialData }: PostcardJobFormProps) => {
  const navigate = useNavigate();
  const { handleSubmit, isSubmitting } = usePostcardJobSubmit();

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
      sides: initialData?.sides || "single",
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

  const onSubmit = async (data: PostcardJobFormValues) => {
    await handleSubmit(data, selectedFile, mode === 'edit' ? initialData?.id : undefined);
  };

  return (
    <div>
      <FormProvider {...form}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl bg-white p-6 rounded-lg shadow">
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
