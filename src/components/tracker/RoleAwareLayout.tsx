
import React, { useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import TrackerLayout from "@/components/TrackerLayout";
import { LoadingSpinner } from "@/components/LoadingSpinner";

/**
 * Layout component that manages routing based on user roles
 * 
 * This component intelligently routes users to appropriate views based on their role:
 * - Operators and DTP operators are directed to the factory floor
 * - Managers and admins see the full tracker layout
 */
const RoleAwareLayout: React.FC = () => {
  const { userRole, isLoading, isOperator, isDtpOperator } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return;

    // Redirect operators to factory floor unless they're already there
    if (isOperator && !location.pathname.includes('/factory-floor')) {
      console.log('🔄 Redirecting operator to factory floor view');
      navigate('/tracker/factory-floor', { replace: true });
      return;
    }

    // Redirect non-operators away from factory floor to main tracker
    if (!isOperator && location.pathname.includes('/factory-floor')) {
      console.log('🔄 Redirecting non-operator to main tracker view');
      navigate('/tracker', { replace: true });
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

  // For operators, don't show the full tracker layout
  if (isOperator && location.pathname.includes('/factory-floor')) {
    return <Outlet />;
  }

  // For managers and admins, show the full tracker layout
  return <TrackerLayout />;
};

export default RoleAwareLayout;
