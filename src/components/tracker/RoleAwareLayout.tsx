
import React, { useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import TrackerLayout from "@/components/TrackerLayout";
import { LoadingSpinner } from "@/components/LoadingSpinner";

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

  useEffect(() => {
    if (isLoading) return;

    console.log('🔄 RoleAwareLayout routing check:', {
      userRole,
      isOperator,
      isAdmin,
      isManager,
      isDtpOperator,
      currentPath: location.pathname
    });

    // DTP operators get the beautiful DTP workflow interface
    if (isDtpOperator && !isAdmin && !isManager) {
      // If DTP operator is on /tracker root, redirect to DTP workflow
      if (location.pathname === '/tracker') {
        console.log('🔄 Redirecting DTP operator from tracker root to DTP workflow');
        navigate('/tracker/dtp-workflow', { replace: true });
        return;
      }
      
      // If DTP operator tries to access factory floor or other routes, redirect to DTP workflow
      if (!location.pathname.includes('/dtp-workflow')) {
        console.log('🔄 DTP operator accessing non-DTP route, redirecting to DTP workflow');
        navigate('/tracker/dtp-workflow', { replace: true });
        return;
      }
    }

    // Regular operators (excluding DTP, admins, managers) get factory floor
    if (isOperator && !isDtpOperator && !isAdmin && !isManager) {
      // If regular operator is on /tracker root, redirect to factory floor
      if (location.pathname === '/tracker') {
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
    console.log('✅ User has full access to all routes');
  }, [userRole, isLoading, isOperator, isAdmin, isManager, isDtpOperator, navigate, location.pathname]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
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
