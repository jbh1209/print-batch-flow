
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

const AdminProtectedRoute: React.FC<AdminProtectedRouteProps> = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="animate-spin h-8 w-8 text-batchflow-primary" />
      </div>
    );
  }

  // Redirect non-authenticated users to login
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect non-admin users to dashboard
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default AdminProtectedRoute;
