
import { ReactNode, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { isPreviewMode, secureSignOut } from '@/services/security/securityService';
import { Shield, RefreshCw, LogOut } from 'lucide-react';

interface SecureProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

/**
 * Simplified protected route with improved security validation
 */
const SecureProtectedRoute = ({ children, requireAdmin = false }: SecureProtectedRouteProps) => {
  const { user, isLoading, isAdmin, refreshSession } = useAuth();
  const location = useLocation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Handle session refresh
  const handleSessionRefresh = async () => {
    setIsRefreshing(true);
    try {
      const refreshed = await refreshSession();
      if (refreshed) {
        toast.success('Authentication refreshed successfully');
        window.location.reload();
      } else {
        toast.error('Unable to refresh authentication. Please sign in again.');
      }
    } catch (error) {
      console.error('Error refreshing session:', error);
      toast.error('Authentication error. Please sign in again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // While checking authentication status
  if (isLoading || isRefreshing) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner size={40} />
          <p className="text-sm text-muted-foreground">
            {isRefreshing ? 'Refreshing authentication...' : 'Verifying credentials...'}
          </p>
        </div>
      </div>
    );
  }

  // Skip authentication checks in preview mode
  if (isPreviewMode()) {
    return <>{children}</>;
  }

  // If not authenticated, redirect to login
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // If admin is required but user is not admin
  if (requireAdmin && !isAdmin) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg border p-6 shadow-md">
          <div className="mb-4 flex items-center space-x-2">
            <Shield className="h-5 w-5 text-amber-500" />
            <h2 className="text-xl font-semibold">Administrator Access Required</h2>
          </div>
          <p className="mb-6 text-gray-600">
            This area requires administrator privileges. Your current account doesn't have the necessary permissions.
          </p>
          <div className="flex flex-col space-y-2">
            <Button onClick={handleSessionRefresh} disabled={isRefreshing} className="flex items-center">
              {isRefreshing ? <Spinner size={16} className="mr-2" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh Authentication
            </Button>
            <Button variant="outline" onClick={secureSignOut} className="flex items-center">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // User is authenticated and has admin if required
  return <>{children}</>;
};

export default SecureProtectedRoute;
