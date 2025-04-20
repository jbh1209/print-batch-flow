
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export function useStorageBuckets() {
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, loading } = useAuth();

  // We're removing the bucket checks since we're using direct Supabase storage access
  // consistent with the flyers implementation
  
  return { isInitializing, error };
}
