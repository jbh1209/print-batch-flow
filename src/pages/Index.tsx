import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/tracker/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import AppSelector from './AppSelector';
import { LoadingSpinner } from '@/components/LoadingSpinner';

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { userRole, isLoading: roleLoading, isOperator, isDtpOperator, isAdmin, isManager } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    // Don't proceed if still loading auth or roles
    if (authLoading || roleLoading) return;

    // Redirect to auth if not logged in
    if (!user) {
      navigate("/auth");
      return;
    }

    // Direct operator routing - bypass app selector entirely
    if (isOperator && !isAdmin && !isManager) {
      if (isDtpOperator) {
        navigate('/tracker/dtp-workflow', { replace: true });
      } else {
        navigate('/tracker/factory-floor', { replace: true });
      }
      return;
    }

    // Admins and managers get the app selector
  }, [user, authLoading, roleLoading, isOperator, isDtpOperator, isAdmin, isManager, navigate]);

  // Show loading while checking auth and roles
  if (authLoading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <LoadingSpinner />
          <p className="text-gray-600">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if redirecting
  if (!user || (isOperator && !isAdmin && !isManager)) {
    return null;
  }

  // Show app selector for admins and managers
  return <AppSelector />;
};

export default Index;
