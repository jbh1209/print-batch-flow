
import { ReactNode, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { isPreviewMode } from '@/services/core/previewService';
import { secureSignOut } from '@/services/security/securityService';

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, isLoading, session, refreshSession, refreshProfile } = useAuth();
  const location = useLocation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Attempt to refresh the session if needed with improved security
  const handleSessionRefresh = async () => {
    setIsRefreshing(true);
    try {
      const newSession = await refreshSession();
      if (!newSession) {
        toast.error('Unable to refresh authentication. Please sign in again.');
      } else {
        toast.success('Authentication refreshed successfully');
        await refreshProfile();
        // Force reload after successful refresh to ensure consistent state
        window.location.reload();
      }
    } catch (error) {
      console.error('Error refreshing session:', error);
      toast.error('Authentication error. Please sign in again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Secure logout with proper auth state cleanup
  const handleSecureSignOut = async () => {
    try {
      await secureSignOut();
      toast.success("Signed out securely");
    } catch (error) {
      console.error("Error during secure sign out:", error);
      // Force navigation to auth page
      window.location.href = '/auth';
    }
  };

  // While checking authentication status
  if (isLoading || isRefreshing) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Spinner size={40} />
      </div>
    );
  }

  // Skip authentication checks in preview mode
  if (isPreviewMode()) {
    return <>{children}</>;
  }

  // Explicitly log authentication state for debugging
  console.log("Auth state:", { 
    user: !!user, 
    session: !!session,
    currentPath: location.pathname
  });

  // If not authenticated, redirect to login
  if (!user || !session) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // User is authenticated
  return <>{children}</>;
};

export default ProtectedRoute;
