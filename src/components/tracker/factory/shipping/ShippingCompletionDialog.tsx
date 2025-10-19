import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package } from "lucide-react";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs/types";
import type { ShippingCompletionFormData, ShippingCompletion } from "./types";
import { ShippingCompletionHistory } from "./ShippingCompletionHistory";
import { useShippingCompletion } from "@/hooks/tracker/useShippingCompletion";

interface ShippingCompletionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  job: AccessibleJob;
  stageInstanceId: string;
  onComplete: () => void;
}

export const ShippingCompletionDialog = ({
  isOpen,
  onClose,
  job,
  stageInstanceId,
  onComplete
}: ShippingCompletionDialogProps) => {
  const { isSubmitting, getShippingHistory, submitShippingCompletion } = useShippingCompletion();
  
  const [formData, setFormData] = useState<ShippingCompletionFormData>({
    qtyShipped: 0,
    qeDnNumber: '',
    courierWaybillNumber: '',
    courierWaybillUrl: '',
    deliveryMethod: 'courier',
    notes: ''
  });

  const [remainingQty, setRemainingQty] = useState(job.qty);
  const [shippingHistory, setShippingHistory] = useState<ShippingCompletion[]>([]);

  useEffect(() => {
    const loadRemainingQty = async () => {
      const history = await getShippingHistory(job.job_id);
      setShippingHistory(history);
      const totalShipped = history.reduce((sum, s) => sum + s.qty_shipped, 0);
      setRemainingQty(job.qty - totalShipped);
      setFormData(prev => ({ ...prev, qtyShipped: job.qty - totalShipped }));
    };
    
    if (isOpen) {
      loadRemainingQty();
    }
  }, [isOpen, job.job_id, job.qty, getShippingHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.qtyShipped <= 0) {
      return;
    }

    if (!formData.qeDnNumber.trim()) {
      return;
    }

    if (formData.deliveryMethod === 'courier' && !formData.courierWaybillNumber.trim()) {
      return;
    }

    const success = await submitShippingCompletion(
      job.job_id,
      stageInstanceId,
      job.qty,
      formData,
      () => {
        onComplete();
        onClose();
      }
    );

    if (!success) {
      // Error already shown in hook
      return;
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Complete Shipping - WO: {job.wo_no}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <div className="text-xs text-muted-foreground">Customer</div>
              <div className="font-medium">{job.customer}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Quantity</div>
              <div className="font-medium">{job.qty} units</div>
            </div>
          </div>

          <ShippingCompletionHistory 
            history={shippingHistory}
            jobQty={job.qty}
          />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="qtyShipped" className="required">
                Quantity Shipped
              </Label>
              <Input
                id="qtyShipped"
                type="number"
                min="1"
                max={remainingQty}
                value={formData.qtyShipped}
                onChange={(e) => setFormData(prev => ({ ...prev, qtyShipped: parseInt(e.target.value) || 0 }))}
                required
              />
              <p className="text-xs text-muted-foreground">
                Remaining: {remainingQty} units
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="qeDnNumber" className="required">
                QE DN Number
              </Label>
              <Input
                id="qeDnNumber"
                value={formData.qeDnNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, qeDnNumber: e.target.value }))}
                placeholder="QE12345"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deliveryMethod" className="required">
                Delivery Method
              </Label>
              <Select
                value={formData.deliveryMethod}
                onValueChange={(value: 'courier' | 'collection' | 'local_delivery') => 
                  setFormData(prev => ({ ...prev, deliveryMethod: value }))
                }
              >
                <SelectTrigger id="deliveryMethod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="courier">Courier</SelectItem>
                  <SelectItem value="collection">Collection</SelectItem>
                  <SelectItem value="local_delivery">Local Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.deliveryMethod === 'courier' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="courierWaybill" className="required">
                    Courier Waybill Number
                  </Label>
                  <Input
                    id="courierWaybill"
                    value={formData.courierWaybillNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, courierWaybillNumber: e.target.value }))}
                    placeholder="ABC123456"
                    required={formData.deliveryMethod === 'courier'}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="waybillUrl">
                    Courier Waybill URL (Optional)
                  </Label>
                  <Input
                    id="waybillUrl"
                    type="url"
                    value={formData.courierWaybillUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, courierWaybillUrl: e.target.value }))}
                    placeholder="https://tracking.courier.com/..."
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes about this shipment..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Processing...' : 'Complete Shipment'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
