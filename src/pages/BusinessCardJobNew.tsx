
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

import { Form } from "@/components/ui/form";
import JobFormHeader from "@/components/business-cards/JobFormHeader";
import JobFormFields from "@/components/business-cards/JobFormFields";
import FileUpload from "@/components/business-cards/FileUpload";
import FormActions from "@/components/business-cards/FormActions";

// Form schema for validation
const formSchema = z.object({
  jobNumber: z.string().min(1, "Job number is required"),
  name: z.string().min(1, "Client name is required"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  doubleSided: z.boolean().default(false),
  laminationType: z.enum(["none", "gloss", "matt", "soft_touch"]),
  paperType: z.string().min(1, "Paper type is required"),
  dueDate: z.date({
    required_error: "Due date is required",
  }),
  file: z.instanceof(File, { message: "PDF file is required" })
});

type FormValues = z.infer<typeof formSchema>;

const BusinessCardJobNew = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jobNumber: `BC-${Date.now().toString().slice(-8)}`,
      name: "",
      quantity: 100,
      doubleSided: false,
      laminationType: "none",
      paperType: "350gsm Matt",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default to 1 week from now
    },
  });

  // Update the form value whenever selectedFile changes
  useState(() => {
    if (selectedFile) {
      form.setValue("file", selectedFile, { shouldValidate: true });
    } else {
      form.setValue("file", undefined as any, { shouldValidate: true });
    }
  });

  const onSubmit = async (data: FormValues) => {
    if (!user) {
      toast.error("Authentication error", {
        description: "You must be logged in to upload jobs"
      });
      return;
    }

    if (!selectedFile) {
      toast.error("Missing file", {
        description: "Please select a PDF file to upload"
      });
      return;
    }

    setIsUploading(true);
    try {
      // 1. Upload file to Supabase Storage - using a single "pdf_files" bucket
      const filePath = `${user.id}/${Date.now()}-${selectedFile.name}`;
      
      const { error: uploadError, data: fileData } = await supabase.storage
        .from("pdf_files")
        .upload(filePath, selectedFile);

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // 2. Get the public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from("pdf_files")
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error("Failed to get public URL for uploaded file");
      }

      // 3. Insert job data into the database
      const { error: insertError } = await supabase
        .from("business_card_jobs")
        .insert({
          job_number: data.jobNumber,
          name: data.name,
          quantity: data.quantity,
          double_sided: data.doubleSided,
          lamination_type: data.laminationType,
          paper_type: data.paperType,
          due_date: data.dueDate.toISOString(),
          file_name: selectedFile.name,
          pdf_url: urlData.publicUrl,
          user_id: user.id,
        });

      if (insertError) {
        throw new Error(insertError.message);
      }

      toast.success("Job created successfully");
      navigate("/batchflow/batches/business-cards?tab=jobs");
    } catch (error) {
      console.error("Error submitting job:", error);
      toast.error("Error creating job", {
        description: error instanceof Error ? error.message : "An unknown error occurred"
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl">
      <JobFormHeader isEditing={false} />

      <div className="bg-white rounded-lg border shadow p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <JobFormFields control={form.control} />
            
            <FileUpload 
              control={form.control} 
              selectedFile={selectedFile} 
              setSelectedFile={(file) => {
                setSelectedFile(file);
                if (file) {
                  // Update the form value whenever selectedFile changes
                  form.setValue("file", file, { shouldValidate: true });
                } else {
                  form.setValue("file", undefined as any, { shouldValidate: false });
                }
              }}
            />

            <FormActions 
              isSubmitting={isUploading} 
              cancelPath="/batchflow/batches/business-cards?tab=jobs" 
            />
          </form>
        </Form>
      </div>
    </div>
  );
};

export default BusinessCardJobNew;
