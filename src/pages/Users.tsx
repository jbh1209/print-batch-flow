
import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users as UsersIcon, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserManagementProvider } from "@/contexts/UserManagementContext";
import { AdminSetupForm } from "@/components/users/AdminSetupForm";
import { EnhancedUserManagement } from "@/components/users/EnhancedUserManagement";
import { LoadingState } from "@/components/users/LoadingState";
import { AccessRestrictedMessage } from "@/components/users/AccessRestrictedMessage";
import { useAdminAuth } from "@/hooks/useAdminAuth";

const Users = () => {
  const navigate = useNavigate();
  const { isAdmin, adminExists, isLoading, error } = useAdminAuth();

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center">
            <UsersIcon className="h-6 w-6 mr-2 text-batchflow-primary" />
            <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          </div>
          <p className="text-gray-500 mt-1">Manage user accounts, roles, and permissions</p>
        </div>
        <Button onClick={() => navigate("/")}>Back to Dashboard</Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Authentication Error: {error}
          </AlertDescription>
        </Alert>
      )}

      {!adminExists ? (
        <>
          <Alert className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No administrators are configured. Set up the first admin account to begin managing users.
            </AlertDescription>
          </Alert>
          <AdminSetupForm />
        </>
      ) : !isAdmin ? (
        <AccessRestrictedMessage />
      ) : (
        <UserManagementProvider>
          <EnhancedUserManagement />
        </UserManagementProvider>
      )}
    </div>
  );
};

export default Users;
