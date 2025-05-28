
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export function useStorageBuckets() {
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, loading } = useAuth();
  
  // Storage buckets are now properly configured via SQL migrations
  // No runtime checks needed as the pdf_files bucket is created in the database
  
  return { 
    isInitializing: false, 
    error: null 
  };
}
