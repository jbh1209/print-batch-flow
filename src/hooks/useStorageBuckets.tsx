
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useStorageBuckets() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const initializeBuckets = async () => {
    try {
      setIsInitializing(true);
      setError(null);
      
      // Only proceed if user is authenticated
      if (!user) {
        setError('Authentication required to access storage');
        setIsInitializing(false);
        return;
      }
      
      // Check if pdf_files bucket exists
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        console.error('Error listing buckets:', bucketsError);
        setError('Failed to check storage buckets');
        return;
      }
      
      // Check if pdf_files bucket exists
      const pdfBucketExists = buckets.some(b => b.name === 'pdf_files');
      
      // We don't need to create the bucket - it should already exist in the Supabase project
      // Just inform the user if there's an issue
      if (!pdfBucketExists) {
        console.warn('pdf_files bucket does not exist in storage');
        setError('Storage not properly configured. Please contact administrator.');
      }
      
    } catch (err) {
      console.error('Error initializing storage buckets:', err);
      setError('Failed to initialize storage. Some file uploads may not work correctly.');
    } finally {
      setIsInitializing(false);
    }
  };
  
  useEffect(() => {
    initializeBuckets();
  }, [user]); // Re-run when user auth state changes
  
  return { isInitializing, error };
}
