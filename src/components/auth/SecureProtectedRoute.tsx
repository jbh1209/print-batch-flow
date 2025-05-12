
import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { isPreviewMode } from '@/services/previewService';
import { secureSignOut } from '@/services/security/securityService';
import { useSecureSessionValidation } from '@/hooks/useSecureSessionValidation';
import { Shield, RefreshCw, LogOut } from 'lucide-react';

interface SecureProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

/**
 * Enhanced protected route with improved security validation
 */
const SecureProtectedRoute = ({ children, requireAdmin = false }: SecureProtectedRouteProps) => {
  const { user, isLoading, isAdmin } = useAuth();
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  const { 
    isValidating, 
    isValid, 
    tokenExpiresAt,
    refreshSession 
  } = useSecureSessionValidation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Handle session refresh with additional security measures
  const handleSessionRefresh = async () => {
    setIsRefreshing(true);
    try {
      const refreshed = await refreshSession();
      if (!refreshed) {
        toast.error('Unable to refresh authentication. Please sign in again.');
      } else {
        toast.success('Authentication refreshed successfully');
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

  useEffect(() => {
    // Only show messages once loading and validation are complete
    if (!isLoading && !isValidating) {
      setAuthChecked(true);
      
      // Check for non-admin trying to access admin-only route
      if (user && requireAdmin && !isAdmin && !isPreviewMode()) {
        toast.error('You need administrator privileges to access this page', {
          icon: <Shield className="text-red-500" />,
        });
      }
      
      // Check for invalid session
      if (user && !isValid && !isPreviewMode()) {
        toast.error('Your session has expired or is invalid', {
          description: 'Please refresh your session or sign in again',
          action: {
            label: 'Refresh',
            onClick: handleSessionRefresh,
          },
        });
      }
    }
  }, [user, requireAdmin, isAdmin, isLoading, isValidating, isValid]);

  // While checking authentication and session validity
  if (isLoading || isValidating || isRefreshing) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner size={40} />
          <p className="text-sm text-muted-foreground">
            {isRefreshing ? 'Refreshing authentication...' : 'Verifying security credentials...'}
          </p>
        </div>
      </div>
    );
  }

  // Skip authentication checks in preview mode
  if (isPreviewMode()) {
    return <>{children}</>;
  }

  // Log authentication state (useful for debugging)
  console.log("Auth security state:", { 
    user: !!user, 
    isValid,
    isAdmin, 
    requireAdmin, 
    authChecked,
    tokenExpiresAt: tokenExpiresAt?.toISOString(),
    currentPath: location.pathname
  });

  // If not authenticated or session invalid, redirect to login
  if (authChecked && (!user || !isValid)) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // If admin is required but user is not admin
  if (requireAdmin && !isAdmin) {
    // Check if this might be a token expiration issue
    const now = new Date();
    const isTokenNearExpiration = tokenExpiresAt && 
      ((tokenExpiresAt.getTime() - now.getTime()) < 10 * 60 * 1000); // 10 minutes
    
    if (isTokenNearExpiration) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center p-4">
          <div className="w-full max-w-md rounded-lg border p-6 shadow-md">
            <div className="mb-4 flex items-center space-x-2">
              <Shield className="h-5 w-5 text-amber-500" />
              <h2 className="text-xl font-semibold">Authentication Renewal Required</h2>
            </div>
            <p className="mb-6 text-gray-600">
              Your admin privileges could not be verified. This may be due to an expired session.
            </p>
            <div className="flex flex-col space-y-2">
              <Button onClick={handleSessionRefresh} disabled={isRefreshing} className="flex items-center">
                {isRefreshing ? <Spinner size={16} className="mr-2" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh Authentication
              </Button>
              <Button variant="outline" onClick={handleSecureSignOut} className="flex items-center">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out Securely
              </Button>
            </div>
          </div>
        </div>
      );
    }
    
    return <Navigate to="/" replace />;
  }

  // User is authenticated with valid session (and has admin if required)
  return <>{children}</>;
};

export default SecureProtectedRoute;
