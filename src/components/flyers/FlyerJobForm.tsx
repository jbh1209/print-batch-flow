
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFlyerJobs } from "@/hooks/useFlyerJobs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { CalendarIcon, ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { FlyerSize, PaperType } from "@/components/batches/types/FlyerTypes";
import FileUpload from "@/components/business-cards/FileUpload";
import { useFileUpload } from "@/hooks/useFileUpload";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";

// Form validation schema
const formSchema = z.object({
  name: z.string().min(1, "Job name is required"),
  job_number: z.string().min(1, "Job number is required"),
  size: z.enum(["A5", "A4", "DL", "A3"]),
  paper_weight: z.string().min(1, "Paper weight is required"),
  paper_type: z.enum(["Matt", "Gloss"]),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  due_date: z.date(),
  file: z.instanceof(File, { message: "PDF file is required" })
});

type FormValues = z.infer<typeof formSchema>;

export const FlyerJobForm = () => {
  const navigate = useNavigate();
  const { createJob } = useFlyerJobs();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  
  // Initialize the file upload hook
  const { 
    selectedFile, 
    setSelectedFile, 
    handleFileChange, 
    fileInfo
  } = useFileUpload({
    acceptedTypes: ['application/pdf'],
    maxSizeInMB: 10
  });

  // Initialize react-hook-form with zod validation
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
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
  useState(() => {
    if (selectedFile) {
      form.setValue("file", selectedFile, { shouldValidate: true });
    } else {
      form.setValue("file", undefined as any, { shouldValidate: false });
    }
  });

  const paperWeightOptions = ["115gsm", "130gsm", "170gsm", "200gsm", "250gsm"];
  const sizeOptions: FlyerSize[] = ["A5", "A4", "DL", "A3"];
  const paperTypeOptions: PaperType[] = ["Matt", "Gloss"];

  const onSubmit = async (data: FormValues) => {
    if (!selectedFile) {
      toast.error("Please upload a PDF file");
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Upload the PDF file to Supabase storage
      const fileName = `${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`;
      const filePath = `${user?.id}/${fileName}`;
      
      toast.loading("Uploading PDF file...");
      
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('pdf_files')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Error uploading file: ${uploadError.message}`);
      }

      // Get the public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from('pdf_files')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error("Failed to get public URL for uploaded file");
      }

      toast.success("File uploaded successfully");

      // Create the job with the PDF URL
      await createJob({
        ...data,
        due_date: data.due_date.toISOString(),
        pdf_url: urlData.publicUrl,
        file_name: selectedFile.name
      });

      toast.success("Flyer job created successfully");
      navigate("/batches/flyers/jobs");
    } catch (error) {
      console.error("Error creating flyer job:", error);
      toast.error(`Failed to create flyer job: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
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

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl bg-white p-6 rounded-lg shadow">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Name*</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="job_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Number*</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="size"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Size*</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sizeOptions.map((size) => (
                        <SelectItem key={size} value={size}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="paper_weight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paper Weight*</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select weight" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {paperWeightOptions.map((weight) => (
                        <SelectItem key={weight} value={weight}>{weight}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="paper_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paper Type*</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {paperTypeOptions.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity*</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
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
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, "PPP") : "Select a date"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => field.onChange(date || new Date())}
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
            name="file"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Upload PDF*</FormLabel>
                <FormControl>
                  <FileUpload
                    control={form.control}
                    selectedFile={selectedFile}
                    setSelectedFile={(file) => {
                      setSelectedFile(file);
                      if (file) {
                        field.onChange(file);
                      } else {
                        field.onChange(undefined);
                      }
                    }}
                    handleFileChange={handleFileChange}
                    isRequired={true}
                    helpText="Upload a PDF file of your flyer design (Max: 10MB)"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
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
    </div>
  );
};
