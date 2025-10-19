export interface ShippingCompletion {
  id: string;
  job_id: string;
  stage_instance_id: string;
  shipment_number: number;
  qty_shipped: number;
  qe_dn_number: string;
  courier_waybill_number: string | null;
  courier_waybill_url: string | null;
  delivery_method: 'courier' | 'collection' | 'local_delivery';
  notes: string | null;
  shipped_by: string | null;
  shipped_at: string;
  created_at: string;
}

export interface ShippingCompletionFormData {
  qtyShipped: number;
  qeDnNumber: string;
  courierWaybillNumber: string;
  courierWaybillUrl: string;
  deliveryMethod: 'courier' | 'collection' | 'local_delivery';
  notes: string;
}
