
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { EnhancedOperatorDashboard } from "@/components/tracker/factory/EnhancedOperatorDashboard";
import { ManagerDashboard } from "@/components/tracker/factory/ManagerDashboard";

/**
 * Factory Floor page component
 * 
 * Displays the appropriate dashboard based on user role:
 * - DTP operators see a specialized DTP view
 * - Operators see the operator dashboard
 * - Managers can switch between operator and manager views
 */
const FactoryFloor = () => {
  const { user } = useAuth();
  const { userRole, isManager, isDtpOperator, isOperator } = useUserRole();
  const [viewMode, setViewMode] = useState<'operator' | 'manager'>('operator');

  // Determine the appropriate title based on user role
  const getTitle = () => {
    if (isDtpOperator) return "DTP Workstation";
    if (isOperator) return "Factory Floor";
    if (isManager) return "Production Manager Dashboard";
    return "Factory Floor";
  };

  const getSubtitle = () => {
    if (isDtpOperator) return "DTP and Proofing jobs";
    if (isOperator) return "Production tracking and job management";
    if (isManager) return "Production oversight and management";
    return "Production tracking and job management";
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="w-full max-w-[95vw] mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
              {!isDtpOperator && (
                <Button variant="outline" size="sm" asChild className="w-fit">
                  <Link to="/tracker" className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Back to Dashboard</span>
                    <span className="sm:hidden">Back</span>
                  </Link>
                </Button>
              )}
              
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold truncate">{getTitle()}</h1>
                <p className="text-sm sm:text-base text-gray-600 truncate">
                  {getSubtitle()}
                </p>
              </div>
            </div>
            
            {isManager && (
              <div className="flex border rounded-md w-full sm:w-auto">
                <Button
                  variant={viewMode === 'operator' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('operator')}
                  className="rounded-r-none flex-1 sm:flex-none"
                >
                  <Users className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="text-xs sm:text-sm">Operator</span>
                </Button>
                <Button
                  variant={viewMode === 'manager' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('manager')}
                  className="rounded-l-none flex-1 sm:flex-none"
                >
                  <Settings className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="text-xs sm:text-sm">Manager</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-[95vw] mx-auto h-[calc(100vh-73px)] sm:h-[calc(100vh-81px)] overflow-hidden">
        <div className="h-full overflow-y-auto">
          {viewMode === 'operator' || !isManager ? (
            <EnhancedOperatorDashboard />
          ) : (
            <ManagerDashboard />
          )}
        </div>
      </div>
    </div>
  );
};

export default FactoryFloor;
