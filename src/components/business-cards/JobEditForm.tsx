
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Form } from "@/components/ui/form";
import { useFileUpload } from "@/hooks/useFileUpload";
import JobFormFields from "@/components/business-cards/JobFormFields";
import FileUpload from "@/components/business-cards/FileUpload";
import FormActions from "@/components/business-cards/FormActions";

// Form schema for validation - simplified for business cards
const formSchema = z.object({
  name: z.string().min(1, "Job name is required"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  doubleSided: z.boolean().default(false),
  dueDate: z.date({
    required_error: "Due date is required",
  }),
  file: z.instanceof(File, { message: "PDF file is required" }).optional()
});

type FormValues = z.infer<typeof formSchema>;

interface JobData {
  name: string;
  quantity: number;
  double_sided: boolean;
  due_date: string;
  pdf_url?: string;
  file_name?: string;
}

interface JobEditFormProps {
  jobData: JobData | null;
  isSaving: boolean;
  onSubmit: (data: FormValues, file: File | null) => Promise<boolean>;
}

const JobEditForm = ({ jobData, isSaving, onSubmit }: JobEditFormProps) => {
  const navigate = useNavigate();
  
  const { selectedFile, setSelectedFile, handleFileChange } = useFileUpload({
    acceptedTypes: ["application/pdf"],
    maxSizeInMB: 10
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      quantity: 100,
      doubleSided: false,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  // Reset form with proper data when jobData changes
  useEffect(() => {
    if (jobData) {
      form.reset({
        name: jobData.name,
        quantity: jobData.quantity,
        doubleSided: jobData.double_sided,
        dueDate: new Date(jobData.due_date),
      });
    }
  }, [jobData, form]);

  const handleFormSubmit = async (data: FormValues) => {
    const success = await onSubmit(data, selectedFile);
    if (success) {
      navigate("/batches/business-cards/jobs");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        <JobFormFields control={form.control} />
        
        <FileUpload 
          control={form.control} 
          selectedFile={selectedFile} 
          setSelectedFile={setSelectedFile}
          handleFileChange={handleFileChange}
          isRequired={false}
          helpText="Upload a new PDF only if you want to replace the current file"
        />

        <FormActions 
          isSubmitting={isSaving}
          submitLabel="Save Changes" 
          cancelPath="/batches/business-cards/jobs"
          onCancel={() => navigate("/batches/business-cards/jobs")}
        />
      </form>
    </Form>
  );
};

export default JobEditForm;
