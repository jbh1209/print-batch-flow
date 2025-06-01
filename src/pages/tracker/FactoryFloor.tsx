
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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" asChild>
                <Link to="/tracker" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Dashboard
                </Link>
              </Button>
              
              <div>
                <h1 className="text-2xl font-bold">Factory Floor</h1>
                <p className="text-gray-600">
                  Production tracking and job management
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {canAccessManagerView && (
                <div className="flex border rounded-md">
                  <Button
                    variant={viewMode === 'operator' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('operator')}
                    className="rounded-r-none"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Operator
                  </Button>
                  <Button
                    variant={viewMode === 'manager' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('manager')}
                    className="rounded-l-none"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Manager
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {viewMode === 'operator' ? (
          <OperatorDashboard />
        ) : (
          <ManagerDashboard />
        )}
      </div>
    </div>
  );
};

export default FactoryFloor;
