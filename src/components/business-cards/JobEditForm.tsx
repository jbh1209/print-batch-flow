
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
import { Form } from "@/components/ui/form";
import { useFileUpload } from "@/hooks/useFileUpload";
import JobFormFields from "@/components/business-cards/JobFormFields";
import FileUpload from "@/components/business-cards/FileUpload";
import FormActions from "@/components/business-cards/FormActions";

// Form schema for validation
const formSchema = z.object({
  name: z.string().min(1, "Job name is required"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  doubleSided: z.boolean().default(false),
  laminationType: z.enum(["none", "gloss", "matt", "soft_touch"]),
  paperType: z.string().min(1, "Paper type is required"),
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
  lamination_type: string;
  paper_type: string;
  due_date: string;
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
      name: jobData?.name || "",
      quantity: jobData?.quantity || 100,
      doubleSided: jobData?.double_sided || false,
      laminationType: jobData?.lamination_type || "none",
      paperType: jobData?.paper_type || "350gsm Matt",
      dueDate: jobData?.due_date ? new Date(jobData.due_date) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

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
