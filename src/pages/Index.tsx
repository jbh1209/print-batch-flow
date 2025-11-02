import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/tracker/useUserRole';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import AppSelector from './AppSelector';

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const { userRole, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to auth if not logged in
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    // If user is authenticated and role is loaded, redirect to role-specific workspace
    if (!authLoading && !roleLoading && user) {
      // Redirect DTP operators to their specialized workflow
      if (userRole === 'dtp_operator') {
        navigate('/tracker/dtp-workflow');
        return;
      }
      // Redirect Packaging operators to Packaging & Shipping
      if (userRole === 'packaging_operator') {
        navigate('/tracker/packaging-shipping');
        return;
      }
      // Redirect regular operators to factory floor
      if (userRole === 'operator') {
        navigate('/tracker/factory-floor');
        return;
      }
      // Redirect admins and managers to tracker dashboard
      if (userRole === 'admin' || userRole === 'manager') {
        navigate('/tracker/dashboard');
        return;
      }
    }
  }, [user, authLoading, userRole, roleLoading, navigate]);

  // Show loading while checking auth and role
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
  if (!user || userRole === 'operator' || userRole === 'dtp_operator' || userRole === 'packaging_operator' || userRole === 'admin' || userRole === 'manager') {
    return null;
  }

  return <AppSelector />;
};

export default Index;
