
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useJobSpecificationStorage } from "@/hooks/useJobSpecificationStorage";
import { SpecificationSectionRHF } from "./SpecificationSectionRHF";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

// Form validation schema
const jobFormSchema = z.object({
  wo_no: z.string().min(1, "Work Order Number is required"),
  customer: z.string().min(1, "Customer is required"),
  reference: z.string().optional(),
  qty: z.number().min(1, "Quantity must be at least 1"),
  due_date: z.date(),
  location: z.string().optional(),
  specifications: z.record(z.any()).optional()
});

type JobFormData = z.infer<typeof jobFormSchema>;

interface BatchJobFormRHFProps {
  batchCategory: string;
  onJobCreated: () => void;
  onCancel: () => void;
}

export const BatchJobFormRHF: React.FC<BatchJobFormRHFProps> = ({
  batchCategory,
  onJobCreated,
  onCancel
}) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { storeJobSpecifications } = useJobSpecificationStorage();

  const form = useForm<JobFormData>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      wo_no: "",
      customer: "",
      reference: "",
      qty: 1,
      due_date: new Date(),
      location: "",
      specifications: {}
    }
  });

  const handleSpecificationChange = (specifications: Record<string, any>) => {
    form.setValue('specifications', specifications);
  };

  const onSubmit = async (data: JobFormData) => {
    if (!user) {
      toast.error("User not authenticated");
      return;
    }

    setIsSubmitting(true);

    try {
      // Create the production job first
      const { data: jobData, error: jobError } = await supabase
        .from('production_jobs')
        .insert({
          wo_no: data.wo_no,
          customer: data.customer,
          reference: data.reference || "",
          qty: data.qty,
          due_date: data.due_date.toISOString().split('T')[0],
          location: data.location || "",
          user_id: user.id,
          category: batchCategory,
          status: 'Pre-Press'
        })
        .select()
        .single();

      if (jobError) {
        console.error('Job creation error:', jobError);
        throw jobError;
      }

      if (!jobData) {
        throw new Error('No job data returned');
      }

      console.log('Job created successfully:', jobData);

      // Store specifications if any were selected
      if (data.specifications && Object.keys(data.specifications).length > 0) {
        try {
          await storeJobSpecifications(jobData.id, 'production_jobs', data.specifications);
          console.log('Specifications stored successfully');
        } catch (specError) {
          console.error('Error storing specifications:', specError);
          // Don't fail the whole operation if specification storage fails
          toast.error('Job created but specifications could not be saved');
        }
      }

      toast.success("Job created successfully");
      form.reset();
      onJobCreated();
    } catch (error) {
      console.error('Error creating job:', error);
      toast.error(error instanceof Error ? error.message : "Failed to create job");
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

          <SpecificationSectionRHF
            batchCategory={batchCategory}
            onSpecificationChange={handleSpecificationChange}
            disabled={isSubmitting}
          />

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Job"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};
