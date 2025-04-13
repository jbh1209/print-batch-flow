
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

import { Form } from "@/components/ui/form";
import JobFormHeader from "@/components/business-cards/JobFormHeader";
import JobFormFields from "@/components/business-cards/JobFormFields";
import FileUpload from "@/components/business-cards/FileUpload";
import FormActions from "@/components/business-cards/FormActions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useFileUpload } from "@/hooks/useFileUpload";

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

const BusinessCardJobEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { selectedFile, setSelectedFile, handleFileChange, fileInfo } = useFileUpload({
    acceptedTypes: ["application/pdf"],
    maxSizeInMB: 10
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      quantity: 100,
      doubleSided: false,
      laminationType: "none",
      paperType: "350gsm Matt",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default to 1 week from now
    },
  });

  // Fetch job data
  useEffect(() => {
    const fetchJobData = async () => {
      if (!id || !user) return;
      
      try {
        const { data, error } = await supabase
          .from("business_card_jobs")
          .select("*")
          .eq("id", id)
          .eq("user_id", user.id)
          .single();
          
        if (error) throw error;
        
        if (!data) {
          setError("Job not found or you don't have permission to view it.");
          return;
        }
        
        // Update form values
        form.reset({
          name: data.name,
          quantity: data.quantity,
          doubleSided: data.double_sided,
          laminationType: data.lamination_type,
          paperType: data.paper_type,
          dueDate: new Date(data.due_date),
        });
        
      } catch (error) {
        console.error("Error fetching job:", error);
        setError("Failed to load job details.");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchJobData();
  }, [id, user, form]);

  const onSubmit = async (data: FormValues) => {
    if (!user) {
      toast({
        title: "Authentication error",
        description: "You must be logged in to update jobs",
        variant: "destructive",
      });
      return;
    }

    if (!id) {
      toast({
        title: "Error",
        description: "Job ID is missing",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      let pdfUrl = undefined;
      let fileName = undefined;
      
      // If a new file was selected, upload it
      if (selectedFile) {
        const filePath = `${user.id}/${selectedFile.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from("pdf_files")
          .upload(filePath, selectedFile, { upsert: true });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        // Get the public URL for the uploaded file
        const { data: urlData } = supabase.storage
          .from("pdf_files")
          .getPublicUrl(filePath);

        if (!urlData?.publicUrl) {
          throw new Error("Failed to get public URL for uploaded file");
        }
        
        pdfUrl = urlData.publicUrl;
        fileName = selectedFile.name;
      }

      // Update job data in the database
      const updateData: Record<string, any> = {
        name: data.name,
        quantity: data.quantity,
        double_sided: data.doubleSided,
        lamination_type: data.laminationType,
        paper_type: data.paperType,
        due_date: data.dueDate.toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      // Only add file data if a new file was uploaded
      if (pdfUrl && fileName) {
        updateData.pdf_url = pdfUrl;
        updateData.file_name = fileName;
      }

      const { error: updateError } = await supabase
        .from("business_card_jobs")
        .update(updateData)
        .eq("id", id)
        .eq("user_id", user.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      sonnerToast.success("Job updated successfully");
      navigate("/batches/business-cards/jobs");
    } catch (error) {
      console.error("Error updating job:", error);
      toast({
        title: "Error updating job",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (error) {
    return (
      <div className="container mx-auto max-w-4xl">
        <JobFormHeader title="Edit Business Card Job" subtitle="Update the details of your business card job" />
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="flex justify-center">
          <button 
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded"
            onClick={() => navigate("/batches/business-cards/jobs")}
          >
            Back to Jobs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl">
      <JobFormHeader 
        title="Edit Business Card Job" 
        subtitle="Update the details of your business card job" 
      />

      <div className="bg-white rounded-lg border shadow p-6">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
        )}
      </div>
    </div>
  );
};

export default BusinessCardJobEdit;
