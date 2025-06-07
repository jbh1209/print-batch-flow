
import React, { useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useSimplePermissions } from "@/hooks/tracker/useSimplePermissions";
import TrackerLayout from "@/components/tracker/TrackerLayout";
import { LoadingSpinner } from "@/components/LoadingSpinner";

/**
 * Simplified Layout component that manages routing based on user roles
 * 
 * Much simpler than before - only restricts pure operators to factory floor
 */
const RoleAwareLayout: React.FC = () => {
  const { permissions, isLoading } = useSimplePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return;

    console.log('🔄 RoleAwareLayout routing check:', {
      isOperator: permissions.isOperator,
      isAdmin: permissions.isAdmin,
      isManager: permissions.isManager,
      currentPath: location.pathname
    });

    // Only restrict pure operators (not admins or managers) to factory floor
    if (permissions.isOperator && !permissions.isAdmin && !permissions.isManager) {
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

    // For admins, managers, and other users - no restrictions
    console.log('✅ User has full access to all routes');
  }, [permissions, isLoading, navigate, location.pathname]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  // For pure operators on factory floor, show standalone view without TrackerLayout
  if (permissions.isOperator && !permissions.isAdmin && !permissions.isManager && location.pathname.includes('/factory-floor')) {
    return <Outlet />;
  }

  // For everyone else, show full tracker layout
  return <TrackerLayout />;
};

export default RoleAwareLayout;
