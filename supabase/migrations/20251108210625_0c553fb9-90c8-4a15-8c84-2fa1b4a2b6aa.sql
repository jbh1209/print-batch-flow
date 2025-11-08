-- Update james@impressweb.co.za to administrator role
UPDATE public.user_roles 
SET role = 'admin', updated_at = now()
WHERE user_id = 'cad64226-76e3-4f6c-8750-da9508ca0f5d';