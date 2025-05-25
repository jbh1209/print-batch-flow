
import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users as UsersIcon, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthDebugger } from "@/components/users/AuthDebugger";
import { UserManagementProvider } from "@/contexts/UserManagementContext";
import { AdminSetupForm } from "@/components/users/AdminSetupForm";
import { UserTableContainer } from "@/components/users/UserTableContainer";
import { LoadingState } from "@/components/users/LoadingState";
import { AccessRestrictedMessage } from "@/components/users/AccessRestrictedMessage";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAuth } from "@/hooks/useAuth";

// Main content component separated from provider setup
const UsersContent = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, adminExists, isLoading, error } = useAdminAuth();

  console.log('Users page state:', { isAdmin, adminExists, isLoading, user: !!user });

  // Show loading state
  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center">
            <UsersIcon className="h-6 w-6 mr-2 text-batchflow-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          </div>
          <p className="text-gray-500 mt-1">Manage user accounts and permissions</p>
        </div>
        <Button onClick={() => navigate("/")}>Back to Dashboard</Button>
      </div>

      {/* Show auth debugger for troubleshooting */}
      {user && <AuthDebugger />}

      {/* Display any errors */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!adminExists ? (
        <AdminSetupForm />
      ) : !isAdmin ? (
        <AccessRestrictedMessage />
      ) : (
        <UserManagementProvider>
          <UserTableContainer />
        </UserManagementProvider>
      )}
    </div>
  );
};

// Wrapper component
const Users = () => {
  return <UsersContent />;
};

export default Users;
