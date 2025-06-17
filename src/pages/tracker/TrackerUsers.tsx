
import React from "react";
import { Button } from "@/components/ui/button";
import { Users as UsersIcon, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { UserManagementProvider } from "@/contexts/UserManagementContext";
import { EnhancedUserManagement } from "@/components/users/EnhancedUserManagement";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { AccessRestrictedMessage } from "@/components/users/AccessRestrictedMessage";
import { LoadingState } from "@/components/users/LoadingState";

const TrackerUsers = () => {
  const { isAdmin, isLoading } = useAdminAuth();

  if (isLoading) {
    return <LoadingState />;
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" asChild>
            <Link to="/tracker" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
        <AccessRestrictedMessage />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-4 mb-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/tracker" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
          <div className="flex items-center">
            <UsersIcon className="h-6 w-6 mr-2 text-green-600" />
            <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          </div>
          <p className="text-gray-500 mt-1">Manage user accounts, roles, and permissions for Tracker</p>
        </div>
      </div>

      <UserManagementProvider>
        <EnhancedUserManagement />
      </UserManagementProvider>
    </div>
  );
};

export default TrackerUsers;
