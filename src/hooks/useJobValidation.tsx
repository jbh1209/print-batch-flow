
import { useAuth } from '@/hooks/useAuth';

export function useJobValidation() {
  const { user } = useAuth();

  const validateUser = () => {
    if (!user) {
      throw new Error('User not authenticated');
    }
    return user;
  };

  return { validateUser };
}
