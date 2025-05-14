import { supabase } from '@/integrations/supabase/client';
import { isPreviewMode } from '@/services/previewService';
import { UserWithRole, validateUserRole } from '@/types/user-types';

// Type-safe role validation - re-export from user-types for convenience
export { validateUserRole } from '@/types/user-types';
