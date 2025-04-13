
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CreditCard, ArrowLeft, Upload, Calendar } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  file: z.instanceof(File, { message: "PDF file is required" })
});

type FormValues = z.infer<typeof formSchema>;

const BusinessCardJobNew = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF file",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      form.setValue("file", file);
    }
  };

  const onSubmit = async (data: FormValues) => {
    if (!user) {
      toast({
        title: "Authentication error",
        description: "You must be logged in to upload jobs",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      // 1. Upload file to Supabase Storage
      const fileExt = "pdf";
      const fileName = `${Date.now()}_${data.name.replace(/\s+/g, '_').toLowerCase()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError, data: fileData } = await supabase.storage
        .from("pdf_files")
        .upload(filePath, data.file);

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
          name: data.name,
          quantity: data.quantity,
          double_sided: data.doubleSided,
          lamination_type: data.laminationType,
          paper_type: data.paperType,
          due_date: data.dueDate.toISOString(),
          file_name: fileName,
          pdf_url: urlData.publicUrl,
          user_id: user.id,
        });

      if (insertError) {
        throw new Error(insertError.message);
      }

      sonnerToast.success("Job created successfully");
      navigate("/batches/business-cards/jobs");
    } catch (error) {
      console.error("Error submitting job:", error);
      toast({
        title: "Error creating job",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <CreditCard className="h-6 w-6 mr-2 text-batchflow-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Add New Business Card Job</h1>
        </div>
        <Button 
          variant="outline" 
          onClick={() => navigate("/batches/business-cards/jobs")}
          className="flex items-center gap-1"
        >
          <ArrowLeft size={16} />
          <span>Back to Jobs</span>
        </Button>
      </div>

      <div className="bg-white rounded-lg border shadow p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. John Smith Business Cards" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paperType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paper Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select paper type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="350gsm Matt">350gsm Matt</SelectItem>
                        <SelectItem value="350gsm Silk">350gsm Silk</SelectItem>
                        <SelectItem value="400gsm Matt">400gsm Matt</SelectItem>
                        <SelectItem value="400gsm Silk">400gsm Silk</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="laminationType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lamination Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select lamination type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="gloss">Gloss</SelectItem>
                        <SelectItem value="matt">Matt</SelectItem>
                        <SelectItem value="soft_touch">Soft Touch</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <Calendar className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="doubleSided"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Double Sided</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="file"
              render={({ field: { value, ...fieldProps } }) => (
                <FormItem>
                  <FormLabel>Upload PDF</FormLabel>
                  <div className="flex items-center gap-3">
                    <Input 
                      type="file" 
                      accept=".pdf" 
                      onChange={handleFileChange} 
                      className="hidden"
                      id="pdf-upload"
                      {...fieldProps}
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="w-full border-dashed border-2 p-6 h-auto flex flex-col items-center gap-2"
                      onClick={() => document.getElementById('pdf-upload')?.click()}
                    >
                      <Upload size={24} />
                      <div>
                        {selectedFile ? (
                          <span>{selectedFile.name}</span>
                        ) : (
                          <span>Click to upload PDF file</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        PDF file only, max 10MB
                      </div>
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => navigate("/batches/business-cards/jobs")}>
                Cancel
              </Button>
              <Button type="submit" disabled={isUploading}>
                {isUploading ? "Uploading..." : "Create Job"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default BusinessCardJobNew;
