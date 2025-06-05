
import React, { useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import TrackerLayout from "@/components/TrackerLayout";
import { LoadingSpinner } from "@/components/LoadingSpinner";

/**
 * Layout component that manages routing based on user roles
 * 
 * This component intelligently routes users to appropriate views based on their role:
 * - Operators are restricted to factory floor only
 * - Managers, admins, and DTP operators see the full tracker layout
 */
const RoleAwareLayout: React.FC = () => {
  const { userRole, isLoading, isOperator } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return;

    // Only restrict operators - redirect them to factory floor if they try to access other routes
    if (isOperator) {
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

    // For non-operators (admins, managers, DTP operators), no restrictions - let them access any route
  }, [userRole, isLoading, isOperator, navigate, location.pathname]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  // For operators on factory floor, show standalone view without TrackerLayout
  if (isOperator && location.pathname.includes('/factory-floor')) {
    return <Outlet />;
  }

  // For everyone else (managers, admins, DTP operators), show full tracker layout
  return <TrackerLayout />;
};

export default RoleAwareLayout;
