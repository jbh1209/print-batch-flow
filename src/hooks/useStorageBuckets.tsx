
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useStorageBuckets() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // This function now simply checks if required buckets exist - it doesn't try to create them
  const checkBuckets = async () => {
    try {
      setIsInitializing(true);
      setError(null);
      
      // Only proceed if user is authenticated
      if (!user) {
        setIsInitializing(false);
        return;
      }
      
      // Check if required buckets exist
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        console.error('Error listing buckets:', bucketsError);
        setError('Failed to check storage buckets');
        return;
      }
      
      // We expect these buckets to exist in the Supabase project
      const requiredBuckets = ['pdf_files'];
      const missingBuckets = requiredBuckets.filter(
        required => !buckets.some(b => b.name === required)
      );
      
      if (missingBuckets.length > 0) {
        console.warn(`Missing required buckets: ${missingBuckets.join(', ')}`);
        setError('Storage not properly configured. Please contact administrator.');
      }
      
    } catch (err) {
      console.error('Error checking storage buckets:', err);
      setError('Failed to initialize storage');
    } finally {
      setIsInitializing(false);
    }
  };
  
  useEffect(() => {
    checkBuckets();
  }, [user]); // Re-run when user auth state changes
  
  return { isInitializing, error };
}
