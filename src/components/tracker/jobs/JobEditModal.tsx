
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatWONumber, isValidWONumber } from "@/utils/woNumberFormatter";
import { useProductionStages } from "@/hooks/tracker/useProductionStages";

interface JobEditModalProps {
  job: any;
  onClose: () => void;
  onSave: () => void;
}

export const JobEditModal: React.FC<JobEditModalProps> = ({
  job,
  onClose,
  onSave
}) => {
  const { stages } = useProductionStages();
  const [formData, setFormData] = useState({
    wo_no: job.wo_no || '',
    customer: job.customer || '',
    reference: job.reference || '',
    qty: job.qty || '',
    due_date: job.due_date ? new Date(job.due_date) : null,
    location: job.location || '',
    rep: job.rep || '',
    so_no: job.so_no || '',
    qt_no: job.qt_no || ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [woError, setWoError] = useState<string>("");

  const handleWONumberChange = (value: string) => {
    const formatted = formatWONumber(value);
    setFormData(prev => ({ ...prev, wo_no: formatted }));
    
    // Validate WO number
    if (formatted && !isValidWONumber(formatted)) {
      setWoError("Work order number must start with 'D' followed by at least 6 digits");
    } else {
      setWoError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate WO number before submission
    if (!isValidWONumber(formData.wo_no)) {
      setWoError("Please enter a valid work order number (D + 6 digits minimum)");
      return;
    }
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('production_jobs')
        .update({
          wo_no: formData.wo_no,
          customer: formData.customer || null,
          reference: formData.reference || null,
          qty: formData.qty ? parseInt(formData.qty) : null,
          due_date: formData.due_date ? formData.due_date.toISOString().split('T')[0] : null,
          location: formData.location || null,
          rep: formData.rep || null,
          so_no: formData.so_no || null,
          qt_no: formData.qt_no || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);

      if (error) throw error;

      toast.success('Job updated successfully');
      onSave();
    } catch (error) {
      console.error('Error updating job:', error);
      toast.error('Failed to update job');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Job</DialogTitle>
          <DialogDescription>
            Update job details and information. Job status is managed through workflow stages.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="wo_no">Work Order Number *</Label>
              <Input
                id="wo_no"
                value={formData.wo_no}
                onChange={(e) => handleWONumberChange(e.target.value)}
                placeholder="D424836"
                className={cn(woError && "border-red-500")}
              />
              {woError && (
                <p className="text-sm text-red-600">{woError}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer">Customer</Label>
              <Input
                id="customer"
                value={formData.customer}
                onChange={(e) => setFormData(prev => ({ ...prev, customer: e.target.value }))}
                placeholder="Customer name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reference">Reference</Label>
              <Input
                id="reference"
                value={formData.reference}
                onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
                placeholder="Job reference"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="qty">Quantity</Label>
              <Input
                id="qty"
                type="number"
                value={formData.qty}
                onChange={(e) => setFormData(prev => ({ ...prev, qty: e.target.value }))}
                placeholder="1000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.due_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.due_date ? format(formData.due_date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.due_date || undefined}
                    onSelect={(date) => setFormData(prev => ({ ...prev, due_date: date || null }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Current Stage Display (Read-Only) */}
            <div className="space-y-2">
              <Label>Current Stage</Label>
              <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                <span className="text-sm text-gray-600">
                  {job.current_stage || job.status || 'No Workflow'}
                </span>
                <p className="text-xs text-gray-500 mt-1">
                  Stage changes are managed through the workflow system
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rep">Rep</Label>
              <Input
                id="rep"
                value={formData.rep}
                onChange={(e) => setFormData(prev => ({ ...prev, rep: e.target.value }))}
                placeholder="Sales rep"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="so_no">SO Number</Label>
              <Input
                id="so_no"
                value={formData.so_no}
                onChange={(e) => setFormData(prev => ({ ...prev, so_no: e.target.value }))}
                placeholder="Sales order number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="qt_no">Quote Number</Label>
              <Input
                id="qt_no"
                value={formData.qt_no}
                onChange={(e) => setFormData(prev => ({ ...prev, qt_no: e.target.value }))}
                placeholder="Quote number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              placeholder="Job location"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !!woError}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
