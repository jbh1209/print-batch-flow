
-- Remove hardcoded specification columns from all batch job tables
-- Keep only core job fields and store all specifications in job_print_specifications table

-- Remove specification columns from sleeve_jobs
ALTER TABLE public.sleeve_jobs 
DROP COLUMN IF EXISTS stock_type;

-- Remove specification columns from business_card_jobs  
ALTER TABLE public.business_card_jobs
DROP COLUMN IF EXISTS lamination_type,
DROP COLUMN IF EXISTS paper_type;

-- Remove specification columns from flyer_jobs
ALTER TABLE public.flyer_jobs
DROP COLUMN IF EXISTS size,
DROP COLUMN IF EXISTS paper_weight,
DROP COLUMN IF EXISTS paper_type;

-- Remove specification columns from box_jobs
ALTER TABLE public.box_jobs
DROP COLUMN IF EXISTS paper_type,
DROP COLUMN IF EXISTS lamination_type;

-- Remove specification columns from cover_jobs
ALTER TABLE public.cover_jobs
DROP COLUMN IF EXISTS paper_type,
DROP COLUMN IF EXISTS paper_weight,
DROP COLUMN IF EXISTS lamination_type,
DROP COLUMN IF EXISTS sides,
DROP COLUMN IF EXISTS uv_varnish;

-- Remove specification columns from poster_jobs
ALTER TABLE public.poster_jobs
DROP COLUMN IF EXISTS size,
DROP COLUMN IF EXISTS paper_type,
DROP COLUMN IF EXISTS paper_weight,
DROP COLUMN IF EXISTS lamination_type,
DROP COLUMN IF EXISTS sides;

-- Remove specification columns from postcard_jobs
ALTER TABLE public.postcard_jobs
DROP COLUMN IF EXISTS size,
DROP COLUMN IF EXISTS paper_type,
DROP COLUMN IF EXISTS paper_weight,
DROP COLUMN IF EXISTS lamination_type;

-- Remove specification columns from sticker_jobs
ALTER TABLE public.sticker_jobs
DROP COLUMN IF EXISTS paper_type,
DROP COLUMN IF EXISTS lamination_type;

-- Add comment to document the change
COMMENT ON TABLE public.sleeve_jobs IS 'Core job fields only - specifications stored in job_print_specifications';
COMMENT ON TABLE public.business_card_jobs IS 'Core job fields only - specifications stored in job_print_specifications';
COMMENT ON TABLE public.flyer_jobs IS 'Core job fields only - specifications stored in job_print_specifications';
COMMENT ON TABLE public.box_jobs IS 'Core job fields only - specifications stored in job_print_specifications';
COMMENT ON TABLE public.cover_jobs IS 'Core job fields only - specifications stored in job_print_specifications';
COMMENT ON TABLE public.poster_jobs IS 'Core job fields only - specifications stored in job_print_specifications';
COMMENT ON TABLE public.postcard_jobs IS 'Core job fields only - specifications stored in job_print_specifications';
COMMENT ON TABLE public.sticker_jobs IS 'Core job fields only - specifications stored in job_print_specifications';
