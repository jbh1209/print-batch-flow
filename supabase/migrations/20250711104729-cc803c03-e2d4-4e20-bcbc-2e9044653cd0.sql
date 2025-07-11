-- Add delivery method specifications to print_specifications table
INSERT INTO public.print_specifications (name, display_name, category, description, properties, sort_order, is_active) VALUES
('collection', 'Collection', 'delivery_method', 'Customer collection from premises', '{"type": "collection", "requires_notification": true}', 1, true),
('local_delivery', 'Local Delivery', 'delivery_method', 'Local delivery within service area', '{"type": "delivery", "max_distance_km": 50, "charge_per_km": 2.50}', 2, true),
('courier_delivery', 'Courier Delivery', 'delivery_method', 'Third-party courier delivery', '{"type": "delivery", "service_types": ["standard", "express", "overnight"]}', 3, true),
('postal_delivery', 'Postal Delivery', 'delivery_method', 'Royal Mail or postal service delivery', '{"type": "delivery", "service_types": ["1st_class", "2nd_class", "signed_for", "special_delivery"]}', 4, true),
('urgent_delivery', 'Urgent/Express Delivery', 'delivery_method', 'Same day or express delivery service', '{"type": "delivery", "same_day": true, "express": true}', 5, true);