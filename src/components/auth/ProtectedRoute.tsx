
import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

const ProtectedRoute = ({ children, requireAdmin = false }: ProtectedRouteProps) => {
  const { user, isLoading, isAdmin, session, refreshSession } = useAuth();
  const location = useLocation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Attempt to refresh the session if needed
  const handleSessionRefresh = async () => {
    setIsRefreshing(true);
    try {
      const newSession = await refreshSession();
      if (!newSession) {
        toast.error('Unable to refresh authentication. Please sign in again.');
      } else {
        toast.success('Authentication refreshed successfully');
      }
    } catch (error) {
      console.error('Error refreshing session:', error);
      toast.error('Authentication error. Please sign in again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Only show admin-required message if user is trying to access admin-only route
    if (user && requireAdmin && !isAdmin) {
      toast.error('You need administrator privileges to access this page');
    }
  }, [user, requireAdmin, isAdmin]);

  // While checking authentication status
  if (isLoading || isRefreshing) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Spinner size={40} />
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!user || !session) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // If session exists but token might be expired, show refresh option
  if (user && session && requireAdmin && !isAdmin) {
    // Check if this might be a token expiration issue
    const tokenExpirationTime = session.expires_at ? new Date(session.expires_at * 1000) : null;
    const now = new Date();
    const isTokenNearExpiration = tokenExpirationTime && 
      ((tokenExpirationTime.getTime() - now.getTime()) < 10 * 60 * 1000); // 10 minutes
    
    if (isTokenNearExpiration) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center p-4">
          <div className="w-full max-w-md rounded-lg border p-6 shadow-md">
            <h2 className="mb-4 text-xl font-semibold">Session May Have Expired</h2>
            <p className="mb-6 text-gray-600">
              Your admin privileges could not be verified. This may be due to an expired session.
            </p>
            <div className="flex flex-col space-y-2">
              <Button onClick={handleSessionRefresh} disabled={isRefreshing}>
                {isRefreshing ? <Spinner size={16} className="mr-2" /> : null}
                Refresh Authentication
              </Button>
              <Button variant="outline" onClick={() => window.location.href = '/auth'}>
                Sign In Again
              </Button>
            </div>
          </div>
        </div>
      );
    }
  }

  // If admin required but user is not admin
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  // User is authenticated (and has admin if required)
  return <>{children}</>;
};

export default ProtectedRoute;
