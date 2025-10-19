import { Package, Truck, MapPin, User } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ShippingCompletion } from "./types";

interface ShippingCompletionHistoryProps {
  history: ShippingCompletion[];
  jobQty: number;
}

export const ShippingCompletionHistory = ({
  history,
  jobQty
}: ShippingCompletionHistoryProps) => {
  if (history.length === 0) {
    return null;
  }

  const totalShipped = history.reduce((sum, s) => sum + s.qty_shipped, 0);
  const remaining = jobQty - totalShipped;
  const percentComplete = Math.round((totalShipped / jobQty) * 100);

  const deliveryMethodIcon = (method: string) => {
    switch (method) {
      case 'courier': return <Truck className="h-4 w-4" />;
      case 'collection': return <User className="h-4 w-4" />;
      case 'local_delivery': return <MapPin className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const deliveryMethodLabel = (method: string) => {
    switch (method) {
      case 'courier': return 'Courier';
      case 'collection': return 'Collection';
      case 'local_delivery': return 'Local Delivery';
      default: return method;
    }
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4" />
          Shipping History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {history.map((shipment) => (
          <div key={shipment.id} className="border-l-2 border-primary/20 pl-4 pb-3 last:pb-0">
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Shipment {shipment.shipment_number}
                </Badge>
                <span className="font-medium">{shipment.qty_shipped} units</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {deliveryMethodIcon(shipment.delivery_method)}
                <span>{deliveryMethodLabel(shipment.delivery_method)}</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>DN: {shipment.qe_dn_number}</div>
              {shipment.courier_waybill_number && (
                <div>
                  Waybill: {shipment.courier_waybill_url ? (
                    <a 
                      href={shipment.courier_waybill_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {shipment.courier_waybill_number}
                    </a>
                  ) : shipment.courier_waybill_number}
                </div>
              )}
              <div>
                Shipped: {format(new Date(shipment.shipped_at), 'dd MMM yyyy HH:mm')}
              </div>
              {shipment.notes && (
                <div className="italic mt-1">Note: {shipment.notes}</div>
              )}
            </div>
          </div>
        ))}
        
        <div className="border-t pt-3 mt-3">
          <div className="flex justify-between items-center text-sm font-medium mb-1">
            <span>Total Shipped:</span>
            <span>{totalShipped} / {jobQty} units ({percentComplete}%)</span>
          </div>
          {remaining > 0 && (
            <div className="text-xs text-muted-foreground">
              Remaining: {remaining} units
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
