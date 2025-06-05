
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

    // Only redirect operators to factory floor - let everyone else access all routes
    if (isOperator && !location.pathname.includes('/factory-floor')) {
      console.log('🔄 Redirecting operator to factory floor view');
      navigate('/tracker/factory-floor', { replace: true });
      return;
    }

    // For operators trying to access non-factory-floor routes, redirect them back
    if (isOperator && !location.pathname.includes('/factory-floor') && location.pathname !== '/tracker') {
      console.log('🔄 Operator trying to access restricted route, redirecting to factory floor');
      navigate('/tracker/factory-floor', { replace: true });
      return;
    }
  }, [userRole, isLoading, isOperator, navigate, location.pathname]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  // For operators on factory floor, show standalone view
  if (isOperator && location.pathname.includes('/factory-floor')) {
    return <Outlet />;
  }

  // For everyone else (managers, admins, DTP operators), show full tracker layout
  return <TrackerLayout />;
};

export default RoleAwareLayout;
