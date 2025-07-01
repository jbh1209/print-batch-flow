
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import TrackerLayout from "@/components/TrackerLayout";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

/**
 * Layout component that manages routing based on user roles
 * 
 * This component intelligently routes users to appropriate views based on their role:
 * - DTP operators are routed to the beautiful DTP workflow dashboard
 * - Regular operators (excluding admins/managers/DTP) are restricted to factory floor only
 * - Admins, managers see the full tracker layout
 */
const RoleAwareLayout: React.FC = () => {
  const { userRole, isLoading, isOperator, isAdmin, isManager, isDtpOperator } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();
  const [hasInitialized, setHasInitialized] = useState(false);
  const [initializationTimeout, setInitializationTimeout] = useState(false);

  // Add timeout for role detection to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.warn('⚠️ Role detection timeout - showing fallback UI');
        setInitializationTimeout(true);
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(timeout);
  }, [isLoading]);

  useEffect(() => {
    // Don't proceed with routing logic until role detection is complete
    if (isLoading && !initializationTimeout) return;

    console.log('🔄 RoleAwareLayout routing check:', {
      userRole,
      isOperator,
      isAdmin,
      isManager,
      isDtpOperator,
      currentPath: location.pathname,
      isLoading,
      hasInitialized
    });

    // Mark as initialized to prevent redirect loops
    setHasInitialized(true);

    // Handle routing based on user role with safer logic
    try {
      // DTP operators get the beautiful DTP workflow interface
      if (isDtpOperator && !isAdmin && !isManager) {
        if (location.pathname === '/tracker' || location.pathname === '/tracker/') {
          console.log('🔄 Redirecting DTP operator from tracker root to DTP workflow');
          navigate('/tracker/dtp-workflow', { replace: true });
          return;
        }
        
        // If DTP operator tries to access other routes, redirect to DTP workflow
        if (!location.pathname.includes('/dtp-workflow')) {
          console.log('🔄 DTP operator accessing non-DTP route, redirecting to DTP workflow');
          navigate('/tracker/dtp-workflow', { replace: true });
          return;
        }
      }

      // Regular operators (excluding DTP, admins, managers) get factory floor
      else if (isOperator && !isDtpOperator && !isAdmin && !isManager) {
        if (location.pathname === '/tracker' || location.pathname === '/tracker/') {
          console.log('🔄 Redirecting regular operator from tracker root to factory floor');
          navigate('/tracker/factory-floor', { replace: true });
          return;
        }
        
        // If regular operator tries to access any non-factory-floor route, redirect them back
        if (!location.pathname.includes('/factory-floor')) {
          console.log('🔄 Regular operator trying to access restricted route, redirecting to factory floor');
          navigate('/tracker/factory-floor', { replace: true });
          return;
        }
      }

      // For admins, managers - no restrictions, let them access any route
      console.log('✅ User has full access to all routes or no specific restrictions');
    } catch (error) {
      console.error('❌ Error in routing logic:', error);
    }
  }, [userRole, isLoading, isOperator, isAdmin, isManager, isDtpOperator, navigate, location.pathname, hasInitialized, initializationTimeout]);

  // Show loading state with timeout handling
  if (isLoading && !initializationTimeout) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <LoadingSpinner />
          <p className="text-gray-600">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  // Show error state if role detection failed or timed out
  if (initializationTimeout || (!isLoading && !userRole)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4 p-6 max-w-md text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500" />
          <h2 className="text-xl font-semibold">Unable to load workspace</h2>
          <p className="text-gray-600">
            We're having trouble determining your access level. You can try refreshing the page or contact support.
          </p>
          <div className="flex gap-3">
            <Button onClick={() => window.location.reload()} variant="outline">
              Refresh Page
            </Button>
            <Button onClick={() => navigate('/tracker/factory-floor')} variant="default">
              Go to Factory Floor
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // For DTP operators on DTP workflow, show standalone view without duplicate header
  if (isDtpOperator && !isAdmin && !isManager && location.pathname.includes('/dtp-workflow')) {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <Outlet />
      </div>
    );
  }

  // For regular operators on factory floor, show standalone view without duplicate header
  if (isOperator && !isDtpOperator && !isAdmin && !isManager && location.pathname.includes('/factory-floor')) {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <Outlet />
      </div>
    );
  }

  // For everyone else (admins, managers), show full tracker layout
  return <TrackerLayout />;
};

export default RoleAwareLayout;
