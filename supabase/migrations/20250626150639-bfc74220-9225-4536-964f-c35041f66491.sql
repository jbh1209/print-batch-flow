
-- Create public holidays table
CREATE TABLE public.public_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Add unique constraint to prevent duplicate dates
ALTER TABLE public.public_holidays ADD CONSTRAINT unique_holiday_date UNIQUE (date);

-- Enable Row Level Security
ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing holidays (all authenticated users can view)
CREATE POLICY "All authenticated users can view holidays" 
  ON public.public_holidays 
  FOR SELECT 
  TO authenticated
  USING (true);

-- Create policy for managing holidays (admin only)
CREATE POLICY "Only admins can manage holidays" 
  ON public.public_holidays 
  FOR ALL 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create function to check if a date is a public holiday
CREATE OR REPLACE FUNCTION public.is_public_holiday(check_date date)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.public_holidays 
    WHERE date = check_date AND is_active = true
  );
$$;

-- Insert some common holidays for testing
INSERT INTO public.public_holidays (date, name, description, created_by) VALUES
  ('2024-01-01', 'New Year''s Day', 'Public Holiday', (SELECT id FROM auth.users LIMIT 1)),
  ('2024-12-25', 'Christmas Day', 'Public Holiday', (SELECT id FROM auth.users LIMIT 1)),
  ('2024-12-26', 'Boxing Day', 'Public Holiday', (SELECT id FROM auth.users LIMIT 1)),
  ('2025-01-01', 'New Year''s Day', 'Public Holiday', (SELECT id FROM auth.users LIMIT 1)),
  ('2025-12-25', 'Christmas Day', 'Public Holiday', (SELECT id FROM auth.users LIMIT 1)),
  ('2025-12-26', 'Boxing Day', 'Public Holiday', (SELECT id FROM auth.users LIMIT 1));
