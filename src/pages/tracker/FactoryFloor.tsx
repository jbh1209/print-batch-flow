
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { useDepartments } from "@/hooks/tracker/useDepartments";
import { useAuth } from "@/hooks/useAuth";
import { OperatorDashboard } from "@/components/tracker/factory/OperatorDashboard";
import { ManagerDashboard } from "@/components/tracker/factory/ManagerDashboard";

const FactoryFloor = () => {
  const { user } = useAuth();
  const { userDepartments } = useDepartments();
  const [viewMode, setViewMode] = useState<'operator' | 'manager'>('operator');

  // Check if user has manager privileges (admin role or specific permissions)
  const canAccessManagerView = true; // This should check actual permissions

  return (
    <div className="min-h-screen bg-gray-50 w-full">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="w-full max-w-[95vw] mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <Button variant="outline" size="sm" asChild className="w-fit">
                <Link to="/tracker" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Back to Dashboard</span>
                  <span className="sm:hidden">Back</span>
                </Link>
              </Button>
              
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold truncate">Factory Floor</h1>
                <p className="text-sm sm:text-base text-gray-600 truncate">
                  Production tracking and job management
                </p>
              </div>
            </div>
            
            {canAccessManagerView && (
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
          {viewMode === 'operator' ? (
            <OperatorDashboard />
          ) : (
            <ManagerDashboard />
          )}
        </div>
      </div>
    </div>
  );
};

export default FactoryFloor;
