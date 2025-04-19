
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useStorageBuckets() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initializeBuckets = async () => {
    try {
      setIsInitializing(true);
      
      // Check if pdf_files bucket exists
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        throw bucketsError;
      }
      
      const existingBuckets = buckets.map(b => b.name);
      
      // Create pdf_files bucket if it doesn't exist
      if (!existingBuckets.includes('pdf_files')) {
        const { error: createError } = await supabase.storage.createBucket('pdf_files', {
          public: true,
          fileSizeLimit: 10485760 // 10MB limit for PDFs
        });
        
        if (createError) {
          throw createError;
        }
        
        console.log('Created pdf_files storage bucket');
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
  }, []);
  
  return { isInitializing, error };
}

