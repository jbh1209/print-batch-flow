
import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useJobSpecificationStorage } from "@/hooks/useJobSpecificationStorage";
import { SpecificationSection } from "./SpecificationSection";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

interface BatchJobFormProps {
  batchCategory: string;
  onJobCreated: () => void;
  onCancel: () => void;
  wo_no?: string;
  customer?: string;
  qty?: number;
  due_date?: string;
}

export const BatchJobForm: React.FC<BatchJobFormProps> = ({
  batchCategory,
  onJobCreated,
  onCancel,
  wo_no = "",
  customer = "",
  qty = 0,
  due_date
}) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    wo_no: wo_no,
    customer: customer,
    reference: "",
    qty: qty,
    due_date: due_date ? new Date(due_date) : new Date(),
    location: ""
  });

  const [specifications, setSpecifications] = useState<Record<string, any>>({});
  const { saveJobSpecifications } = useJobSpecificationStorage();

  const handleSpecificationChange = (category: string, specificationId: string, specification: any) => {
    console.log('Specification changed:', { category, specificationId, specification });
    setSpecifications(prev => ({
      ...prev,
      [category]: specification
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("User not authenticated");
      return;
    }

    setIsSubmitting(true);

    try {
      // Create the production job
      const { data: jobData, error: jobError } = await supabase
        .from('production_jobs')
        .insert({
          wo_no: formData.wo_no,
          customer: formData.customer,
          reference: formData.reference,
          qty: formData.qty,
          due_date: formData.due_date.toISOString().split('T')[0],
          location: formData.location,
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
      if (Object.keys(specifications).length > 0) {
        try {
          await saveJobSpecifications(jobData.id, 'production_jobs', specifications);
          console.log('Specifications stored successfully');
        } catch (specError) {
          console.error('Error storing specifications:', specError);
          // Don't fail the whole operation if specification storage fails
          toast.error('Job created but specifications could not be saved');
        }
      }

      toast.success("Job created successfully");
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
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="wo_no">Work Order Number*</Label>
            <Input
              id="wo_no"
              value={formData.wo_no}
              onChange={(e) => setFormData(prev => ({ ...prev, wo_no: e.target.value }))}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="customer">Customer*</Label>
            <Input
              id="customer"
              value={formData.customer}
              onChange={(e) => setFormData(prev => ({ ...prev, customer: e.target.value }))}
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="reference">Reference</Label>
          <Input
            id="reference"
            value={formData.reference}
            onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="qty">Quantity*</Label>
            <Input
              id="qty"
              type="number"
              value={formData.qty}
              onChange={(e) => setFormData(prev => ({ ...prev, qty: parseInt(e.target.value) || 0 }))}
              required
              min="1"
            />
          </div>

          <div>
            <Label>Due Date*</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(formData.due_date, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.due_date}
                  onSelect={(date) => date && setFormData(prev => ({ ...prev, due_date: date }))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div>
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={formData.location}
            onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
          />
        </div>

        <SpecificationSection
          batchCategory={batchCategory}
          specifications={specifications}
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
    </div>
  );
};
