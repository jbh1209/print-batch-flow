
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { ArrowLeft } from "lucide-react";
import { useFileUpload } from "@/hooks/useFileUpload";
import { FlyerJobFormFields } from "./components/FlyerJobFormFields";
import { useFlyerJobForm } from "./hooks/useFlyerJobForm";
import { useJobSpecifications } from "@/hooks/useJobSpecifications";
import { useJobSpecificationDisplay } from "@/hooks/useJobSpecificationDisplay";
import { 
  flyerJobCreateSchema, 
  flyerJobEditSchema, 
  type FlyerJobFormValues 
} from "./schema/flyerJobSchema";
import { FlyerJob } from "../batches/types/FlyerTypes";
import FormActions from "../business-cards/FormActions";

interface FlyerJobFormProps {
  mode?: 'create' | 'edit';
  initialData?: FlyerJob;
}

export const FlyerJobForm = ({ mode = 'create', initialData }: FlyerJobFormProps) => {
  const navigate = useNavigate();
  const { handleSubmit, isSubmitting } = useFlyerJobForm();
  
  const { 
    selectedFile, 
    setSelectedFile, 
    handleFileChange
  } = useFileUpload({
    acceptedTypes: ['application/pdf'],
    maxSizeInMB: 10
  });

  // Use different schema for create vs edit mode
  const schema = mode === 'create' ? flyerJobCreateSchema : flyerJobEditSchema;

  const form = useForm<FlyerJobFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      job_number: "",
      size: "",
      paper_weight: "",
      paper_type: "",
      quantity: 0,
      due_date: new Date()
    }
  });

  // Get specifications for display if editing
  const { getSize, getPaperType, getPaperWeight } = useJobSpecificationDisplay(
    initialData?.id || '', 
    'flyer_jobs'
  );

  // Handle specification changes
  const { handleSpecificationChange } = useJobSpecifications({
    productType: 'flyer',
    onSpecificationChange: (specifications) => {
      // Update form values when specifications change
      if (specifications.size) {
        form.setValue('size', specifications.size.display_name);
      }
      if (specifications.paper_type) {
        form.setValue('paper_type', specifications.paper_type.display_name);
      }
      if (specifications.paper_weight) {
        form.setValue('paper_weight', specifications.paper_weight.display_name);
      }
    }
  });

  // Reset form with proper data when initialData changes
  useEffect(() => {
    if (initialData && mode === 'edit') {
      console.log('Resetting form with data:', initialData);
      form.reset({
        name: initialData.name,
        job_number: initialData.job_number,
        size: getSize(),
        paper_weight: getPaperWeight(),
        paper_type: getPaperType(),
        quantity: initialData.quantity,
        due_date: new Date(initialData.due_date)
      });
    }
  }, [initialData, form, mode, getSize, getPaperType, getPaperWeight]);

  useEffect(() => {
    if (selectedFile) {
      form.setValue("file", selectedFile, { shouldValidate: true });
    } else if (mode === 'create') {
      form.setValue("file", undefined as any, { shouldValidate: false });
    }
  }, [selectedFile, form, mode]);

  const onSubmit = async (data: FlyerJobFormValues) => {
    console.log('Form submission data:', data);
    console.log('Selected file:', selectedFile);
    
    // Ensure we only submit fields that exist in the database schema
    const cleanedData = {
      name: data.name,
      job_number: data.job_number,
      size: data.size,
      paper_weight: data.paper_weight,
      paper_type: data.paper_type,
      quantity: data.quantity,
      due_date: data.due_date
    };
    
    const success = await handleSubmit(cleanedData, selectedFile, mode === 'edit' ? initialData?.id : undefined);
    if (success) {
      console.log('Job submitted successfully');
    }
  };

  return (
    <div>
      <div className="flex items-center mb-6">
        <Button 
          variant="outline" 
          size="sm" 
          className="mr-4"
          onClick={() => navigate("/printstream/batches/flyers/jobs")}
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
              cancelPath="/printstream/batches/flyers/jobs"
            />
          </form>
        </Form>
      </FormProvider>
    </div>
  );
};
