
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useJobSpecificationStorage } from "@/hooks/useJobSpecificationStorage";
import { useFileUpload } from "@/hooks/useFileUpload";
import { SpecificationSectionRHF } from "./SpecificationSectionRHF";
import { FileUploadSectionRHF } from "./FileUploadSectionRHF";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Upload } from "lucide-react";
import { format } from "date-fns";

// Form validation schema - file is required but tracked separately
const jobFormSchema = z.object({
  wo_no: z.string().min(1, "Work Order Number is required"),
  customer: z.string().min(1, "Customer is required"),
  reference: z.string().optional(),
  qty: z.number().min(1, "Quantity must be at least 1"),
  due_date: z.date(),
  location: z.string().optional(),
  specifications: z.record(z.any()).optional(),
  hasFile: z.boolean().refine(val => val === true, {
    message: "PDF file is required"
  })
});

type JobFormData = z.infer<typeof jobFormSchema>;

interface BatchJobFormRHFProps {
  batchCategory: string;
  onJobCreated: () => void;
  onCancel: () => void;
  wo_no?: string;
  customer?: string;
  qty?: number;
  due_date?: string;
}

export const BatchJobFormRHF: React.FC<BatchJobFormRHFProps> = ({
  batchCategory,
  onJobCreated,
  onCancel,
  wo_no = "",
  customer = "",
  qty = 1,
  due_date
}) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { saveJobSpecifications } = useJobSpecificationStorage();
  
  // File upload functionality
  const { 
    selectedFile, 
    setSelectedFile, 
    handleFileChange, 
    clearSelectedFile, 
    fileInfo 
  } = useFileUpload({
    acceptedTypes: ["application/pdf"],
    maxSizeInMB: 10,
    onFileSelected: (file) => {
      // Update the hasFile field when a file is selected
      form.setValue('hasFile', true);
      form.clearErrors('hasFile');
    }
  });

  const form = useForm<JobFormData>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      wo_no: wo_no,
      customer: customer,
      reference: "",
      qty: qty,
      due_date: due_date ? new Date(due_date) : new Date(),
      location: "",
      specifications: {},
      hasFile: false
    }
  });

  const handleSpecificationChange = (category: string, specificationId: string, specification: any) => {
    const currentSpecs = form.getValues('specifications') || {};
    form.setValue('specifications', {
      ...currentSpecs,
      [category]: specification
    });
  };

  const uploadFileToStorage = async (file: File, jobId: string): Promise<string> => {
    const fileName = `${jobId}_${file.name}`;
    const filePath = `batch-jobs/${fileName}`;
    
    const { data, error } = await supabase.storage
      .from('pdf_files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw new Error(`File upload failed: ${error.message}`);
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('pdf_files')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const onSubmit = async (data: JobFormData) => {
    if (!user) {
      toast.error("User not authenticated");
      return;
    }

    if (!selectedFile) {
      toast.error("PDF file is required");
      return;
    }

    setIsSubmitting(true);

    try {
      // Get the batch table name
      const getBatchTableFromCategory = (category: string): string | null => {
        const categoryMap: Record<string, string> = {
          'business_cards': 'business_card_jobs',
          'flyers': 'flyer_jobs',
          'postcards': 'postcard_jobs',
          'posters': 'poster_jobs',
          'stickers': 'sticker_jobs',
          'covers': 'cover_jobs',
          'sleeves': 'sleeve_jobs',
          'boxes': 'box_jobs'
        };
        return categoryMap[category.toLowerCase()] || null;
      };

      const batchTableName = getBatchTableFromCategory(batchCategory);
      if (!batchTableName) {
        throw new Error(`Unknown batch category: ${batchCategory}`);
      }

      // Create a temporary job ID for file naming
      const tempJobId = `temp_${Date.now()}`;
      
      // Upload the file first
      const fileUrl = await uploadFileToStorage(selectedFile, tempJobId);
      
      // Create the batch job with file URL
      const { data: jobData, error: jobError } = await (supabase as any)
        .from(batchTableName)
        .insert({
          name: `Batch Job - ${data.wo_no}`,
          job_number: `BATCH-${data.wo_no}-${Date.now()}`,
          quantity: data.qty,
          due_date: data.due_date.toISOString().split('T')[0],
          user_id: user.id,
          pdf_url: fileUrl,
          file_name: selectedFile.name,
          status: 'queued'
        })
        .select()
        .single();

      if (jobError) {
        console.error('Batch job creation error:', jobError);
        throw jobError;
      }

      if (!jobData) {
        throw new Error('No batch job data returned');
      }

      console.log('Batch job created successfully:', jobData);

      // Store specifications if any were selected
      if (data.specifications && Object.keys(data.specifications).length > 0) {
        try {
          await saveJobSpecifications(jobData.id, batchTableName, data.specifications);
          console.log('Specifications stored successfully');
        } catch (specError) {
          console.error('Error storing specifications:', specError);
          // Don't fail the whole operation if specification storage fails
          toast.warning('Job created but specifications could not be saved');
        }
      }

      toast.success("Batch job created successfully with PDF file");
      form.reset();
      clearSelectedFile();
      onJobCreated();
    } catch (error) {
      console.error('Error creating batch job:', error);
      toast.error(error instanceof Error ? error.message : "Failed to create batch job");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="wo_no"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Work Order Number*</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="customer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer*</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="reference"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reference</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="qty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity*</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="1"
                      {...field}
                      onChange={e => field.onChange(parseInt(e.target.value) || 1)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date*</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, "PPP") : "Select date"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* File Upload Section */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">PDF File *</Label>
            <FileUploadSectionRHF
              selectedFile={selectedFile}
              onFileChange={handleFileChange}
              onClearFile={() => {
                clearSelectedFile();
                form.setValue('hasFile', false);
              }}
              fileInfo={fileInfo}
            />
            <FormField
              control={form.control}
              name="hasFile"
              render={({ field, fieldState }) => (
                <FormItem>
                  {fieldState.error && (
                    <FormMessage>{fieldState.error.message}</FormMessage>
                  )}
                </FormItem>
              )}
            />
          </div>

          <SpecificationSectionRHF
            batchCategory={batchCategory}
            onSpecificationChange={handleSpecificationChange}
            disabled={isSubmitting}
          />

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedFile}>
              {isSubmitting ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-pulse" />
                  Creating Batch Job...
                </>
              ) : (
                "Create Batch Job"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};
