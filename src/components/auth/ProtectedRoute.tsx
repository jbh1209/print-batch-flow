
import { ReactNode, useState, useCallback } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { isPreviewMode } from '@/services/core/previewService';
import { secureSignOut } from '@/services/security/securityService';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

const ProtectedRoute = ({ children, requireAdmin = false }: ProtectedRouteProps) => {
  const { user, isLoading, isAdmin, session, refreshSession, refreshProfile } = useAuth();
  const location = useLocation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [adminChecked, setAdminChecked] = useState(!requireAdmin);
  
  // On-demand admin check - only executed when button is clicked
  const checkAdminStatus = useCallback(async () => {
    if (requireAdmin && user && !isPreviewMode()) {
      await refreshProfile();
      setAdminChecked(true);
    }
  }, [requireAdmin, refreshProfile, user]);
  
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
    isAdmin, 
    requireAdmin, 
    adminChecked,
    currentPath: location.pathname
  });

  // If not authenticated, redirect to login
  if (!user || !session) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // If admin is required but user is not admin
  if (requireAdmin && !isAdmin) {
    // Check if this might be a token expiration issue
    const tokenExpirationTime = session?.expires_at ? new Date(session.expires_at * 1000) : null;
    const now = new Date();
    const isTokenNearExpiration = tokenExpirationTime && 
      ((tokenExpirationTime.getTime() - now.getTime()) < 10 * 60 * 1000); // 10 minutes
    
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg border p-6 shadow-md">
          <h2 className="mb-4 text-xl font-semibold">Administrator Access Required</h2>
          <p className="mb-6 text-gray-600">
            {!adminChecked ? 
              "Checking administrator privileges..." :
              "Your administrator privileges could not be verified."
            }
          </p>
          <div className="flex flex-col space-y-2">
            {!adminChecked && (
              <Button onClick={checkAdminStatus} className="mb-2">
                Check Admin Status
              </Button>
            )}
            <Button onClick={handleSessionRefresh} disabled={isRefreshing}>
              {isRefreshing ? <Spinner size={16} className="mr-2" /> : null}
              Refresh Authentication
            </Button>
            <Button variant="outline" onClick={handleSecureSignOut}>
              Sign Out Securely
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // User is authenticated (and has admin if required)
  return <>{children}</>;
};

export default ProtectedRoute;
