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

    // If user is authenticated and role is loaded, check for operator redirect
    if (!authLoading && !roleLoading && user) {
      // Redirect operators directly to factory floor
      if (userRole === 'operator' || userRole === 'dtp_operator') {
        navigate('/tracker/factory-floor');
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
  if (!user || userRole === 'operator' || userRole === 'dtp_operator') {
    return null;
  }

  return <AppSelector />;
};

export default Index;
