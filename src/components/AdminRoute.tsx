import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/tracker/useUserRole';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { isAdmin, isManager, isLoading } = useUserRole();
  const navigate = useNavigate();

  // Show loading spinner while checking auth and role
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-background">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="animate-spin h-8 w-8 text-primary" />
          <p className="text-sm text-muted-foreground">Verifying permissions...</p>
        </div>
      </div>
    );
  }

  // Allow access for admins and managers only
  if (!isAdmin && !isManager) {
    return (
      <div className="flex justify-center items-center h-screen bg-background">
        <div className="flex flex-col items-center space-y-6 max-w-md text-center p-8">
          <ShieldAlert className="h-16 w-16 text-destructive" />
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Access Restricted</h1>
            <p className="text-muted-foreground">
              You don't have permission to access this area. 
              Administrative functions are restricted to admins and managers only.
            </p>
          </div>
          <Button onClick={() => navigate('/tracker')}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminRoute;
