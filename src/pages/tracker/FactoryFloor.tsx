
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { SchedulerAwareOperatorDashboard } from "@/components/tracker/factory/SchedulerAwareOperatorDashboard";

const FactoryFloor = () => {
  const navigate = useNavigate();
  const { userRole } = useUserRole();

  useEffect(() => {
    // Redirect DTP operators to their specialized dashboard
    if (userRole === 'dtp_operator') {
      navigate('/tracker/dtp-workflow');
    }
  }, [userRole, navigate]);

  // Don't render if we're redirecting DTP operators
  if (userRole === 'dtp_operator') {
    return null;
  }

  return <SchedulerAwareOperatorDashboard />;
};

export default FactoryFloor;
