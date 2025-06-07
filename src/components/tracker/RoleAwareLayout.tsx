
import React, { useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import TrackerLayout from "@/components/TrackerLayout";
import { LoadingSpinner } from "@/components/LoadingSpinner";

/**
 * Layout component that manages routing based on user roles
 * 
 * This component intelligently routes users to appropriate views based on their role:
 * - Operators (excluding admins/managers) are restricted to factory floor only
 * - Admins, managers, and DTP operators see the full tracker layout
 */
const RoleAwareLayout: React.FC = () => {
  const { userRole, isLoading, isOperator, isAdmin, isManager } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return;

    console.log('🔄 RoleAwareLayout routing check:', {
      userRole,
      isOperator,
      isAdmin,
      isManager,
      currentPath: location.pathname
    });

    // Only restrict pure operators (not admins or managers) to factory floor
    if (isOperator && !isAdmin && !isManager) {
      // If operator is on /tracker root, redirect to factory floor
      if (location.pathname === '/tracker') {
        console.log('🔄 Redirecting operator from tracker root to factory floor');
        navigate('/tracker/factory-floor', { replace: true });
        return;
      }
      
      // If operator tries to access any non-factory-floor route, redirect them back
      if (!location.pathname.includes('/factory-floor')) {
        console.log('🔄 Operator trying to access restricted route, redirecting to factory floor');
        navigate('/tracker/factory-floor', { replace: true });
        return;
      }
    }

    // For admins, managers, and DTP operators - no restrictions, let them access any route
    console.log('✅ User has full access to all routes');
  }, [userRole, isLoading, isOperator, isAdmin, isManager, navigate, location.pathname]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  // For pure operators on factory floor, show standalone view without TrackerLayout
  if (isOperator && !isAdmin && !isManager && location.pathname.includes('/factory-floor')) {
    return <Outlet />;
  }

  // For everyone else (admins, managers, DTP operators), show full tracker layout
  return <TrackerLayout />;
};

export default RoleAwareLayout;
