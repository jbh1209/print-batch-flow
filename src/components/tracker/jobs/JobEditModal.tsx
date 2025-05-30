
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
import { Switch } from "@/components/ui/switch";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ProductionJob {
  id: string;
  wo_no: string;
  status: string;
  customer?: string | null;
  category?: string | null;
  qty?: number | null;
  due_date?: string | null;
  location?: string | null;
  rep?: string | null;
  reference?: string | null;
  highlighted?: boolean;
  so_no?: string | null;
  qt_no?: string | null;
  user_name?: string | null;
}

interface JobEditModalProps {
  job: ProductionJob;
  onClose: () => void;
  onSave: () => void;
}

export const JobEditModal: React.FC<JobEditModalProps> = ({
  job,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState({
    wo_no: job.wo_no || '',
    customer: job.customer || '',
    qty: job.qty || 0,
    due_date: job.due_date ? new Date(job.due_date) : null,
    location: job.location || '',
    rep: job.rep || '',
    reference: job.reference || '',
    so_no: job.so_no || '',
    qt_no: job.qt_no || '',
    user_name: job.user_name || '',
    highlighted: job.highlighted || false
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const updateData = {
        wo_no: formData.wo_no,
        customer: formData.customer || null,
        qty: formData.qty || null,
        due_date: formData.due_date ? formData.due_date.toISOString() : null,
        location: formData.location || null,
        rep: formData.rep || null,
        reference: formData.reference || null,
        so_no: formData.so_no || null,
        qt_no: formData.qt_no || null,
        user_name: formData.user_name || null,
        highlighted: formData.highlighted,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('production_jobs')
        .update(updateData)
        .eq('id', job.id);

      if (error) throw error;

      toast.success('Job updated successfully');
      onSave();
      onClose();
    } catch (error) {
      console.error('Error updating job:', error);
      toast.error('Failed to update job');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Job</DialogTitle>
          <DialogDescription>
            Update the job details below. Changes will be reflected across all systems.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="wo_no">Work Order Number *</Label>
            <Input
              id="wo_no"
              value={formData.wo_no}
              onChange={(e) => setFormData({ ...formData, wo_no: e.target.value })}
              placeholder="Enter WO number"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer">Customer</Label>
            <Input
              id="customer"
              value={formData.customer}
              onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
              placeholder="Customer name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qty">Quantity</Label>
            <Input
              id="qty"
              type="number"
              value={formData.qty}
              onChange={(e) => setFormData({ ...formData, qty: parseInt(e.target.value) || 0 })}
              placeholder="Quantity"
            />
          </div>

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
                  onSelect={(date) => setFormData({ ...formData, due_date: date || null })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Location"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rep">Representative</Label>
            <Input
              id="rep"
              value={formData.rep}
              onChange={(e) => setFormData({ ...formData, rep: e.target.value })}
              placeholder="Sales rep"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="so_no">Sales Order #</Label>
            <Input
              id="so_no"
              value={formData.so_no}
              onChange={(e) => setFormData({ ...formData, so_no: e.target.value })}
              placeholder="SO number"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qt_no">Quote #</Label>
            <Input
              id="qt_no"
              value={formData.qt_no}
              onChange={(e) => setFormData({ ...formData, qt_no: e.target.value })}
              placeholder="Quote number"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="user_name">User Name</Label>
            <Input
              id="user_name"
              value={formData.user_name}
              onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
              placeholder="User name"
            />
          </div>

          <div className="col-span-2 space-y-2">
            <Label htmlFor="reference">Reference</Label>
            <Textarea
              id="reference"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              placeholder="Additional reference information"
            />
          </div>

          <div className="col-span-2 flex items-center space-x-2">
            <Switch
              id="highlighted"
              checked={formData.highlighted}
              onCheckedChange={(checked) => setFormData({ ...formData, highlighted: checked })}
            />
            <Label htmlFor="highlighted">Priority Job (Highlighted)</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
