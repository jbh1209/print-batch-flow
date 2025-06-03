
import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import TrackerLayout from "@/components/TrackerLayout";
import { LoadingSpinner } from "@/components/LoadingSpinner";

const RoleAwareLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userRole, isLoading, isOperator, isDtpOperator } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoading) return;

    // Redirect operators to factory floor unless they're already there
    if (isOperator && !location.pathname.includes('/factory-floor')) {
      navigate('/tracker/factory-floor', { replace: true });
      return;
    }

    // Redirect non-operators away from factory floor to main tracker
    if (!isOperator && location.pathname.includes('/factory-floor')) {
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
    return <>{children}</>;
  }

  // For managers and admins, show the full tracker layout
  return <TrackerLayout>{children}</TrackerLayout>;
};

export default RoleAwareLayout;
