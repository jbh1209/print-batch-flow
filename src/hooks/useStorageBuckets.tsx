
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function useStorageBuckets() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, loading } = useAuth();

  // Check if required storage buckets exist
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
        console.error('Error listing storage buckets:', bucketsError);
        setError('Failed to verify storage configuration');
        return;
      }
      
      // Check for the pdf_files bucket which should exist in the project
      const hasPdfBucket = buckets.some(bucket => bucket.name === 'pdf_files');
      
      if (!hasPdfBucket) {
        console.warn('PDF files bucket does not exist');
        setError('Storage not properly configured for PDF uploads');
        toast.error('Storage configuration issue. Please contact administrator.');
      }
      
    } catch (err) {
      console.error('Error checking storage buckets:', err);
      setError('Failed to initialize storage');
    } finally {
      setIsInitializing(false);
    }
  };
  
  useEffect(() => {
    if (!loading) {
      checkBuckets();
    }
  }, [user, loading]); // Re-run when user auth state changes or loading completes
  
  return { isInitializing, error };
}
