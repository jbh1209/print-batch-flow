
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users as UsersIcon, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthDebugger } from "@/components/users/AuthDebugger";
import { UserManagementProvider, useUserManagement } from "@/contexts/UserManagementContext";
import { AdminSetupForm } from "@/components/users/AdminSetupForm";
import { UserTableContainer } from "@/components/users/UserTableContainer";
import { LoadingState } from "@/components/users/LoadingState";
import { AccessRestrictedMessage } from "@/components/users/AccessRestrictedMessage";

// Main content component separated from provider setup
const UsersContent = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { 
    error, 
    isLoading, 
    anyAdminExists, 
    fetchUsers, 
    checkAdminExists 
  } = useUserManagement();

  // Check if any admin exists and load users when component mounts
  useEffect(() => {
    checkAdminExists();
    
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin, checkAdminExists, fetchUsers]);

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

      {!anyAdminExists ? (
        <AdminSetupForm />
      ) : !isAdmin ? (
        <AccessRestrictedMessage />
      ) : (
        <UserTableContainer />
      )}
    </div>
  );
};

// Wrapper component that provides the UserManagementContext
const Users = () => {
  return (
    <UserManagementProvider>
      <UsersContent />
    </UserManagementProvider>
  );
};

export default Users;
