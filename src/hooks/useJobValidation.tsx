
import { useAuth } from '@/hooks/useAuth';

// Check if we're in Lovable preview mode
const isLovablePreview = 
  typeof window !== 'undefined' && 
  (window.location.hostname.includes('gpteng.co') || window.location.hostname.includes('lovable.dev'));

export function useJobValidation() {
  const { user } = useAuth();

  const validateUser = () => {
    // In preview mode, return a mock user
    if (isLovablePreview) {
      return { id: 'preview-user-id', email: 'preview@example.com' };
    }
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    return user;
  };

  return { validateUser };
}
