
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users as UsersIcon, AlertTriangle, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AuthDebugger } from "@/components/users/AuthDebugger";
import { UserManagementProvider, useUserManagement } from "@/contexts/UserManagementContext";
import { AdminSetupForm } from "@/components/users/AdminSetupForm";
import { UserTableContainer } from "@/components/users/UserTableContainer";
import { LoadingState } from "@/components/users/LoadingState";
import { AccessRestrictedMessage } from "@/components/users/AccessRestrictedMessage";
import { toast } from "sonner";

// Main content component separated from provider setup
const UsersContent = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { 
    error, 
    isLoading, 
    anyAdminExists, 
    checkAdminExists,
    fetchUsers
  } = useUserManagement();

  // Check if admin exists when the component mounts
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        console.log("Checking if any admin exists...");
        await checkAdminExists();
      } catch (err) {
        console.error("Failed to check admin existence:", err);
        toast.error("Failed to check if admin exists. Please try again.");
      }
    };
    
    checkAdmin();
  }, [checkAdminExists]);

  // Monitor auth status changes
  useEffect(() => {
    console.log("User auth status in UsersContent:", { isAdmin, userId: user?.id });
    
    // If user is admin, refresh the user list
    if (isAdmin) {
      fetchUsers().catch(err => {
        console.error("Failed to fetch users:", err);
      });
    }
  }, [isAdmin, user?.id, fetchUsers]);

  const handleRefresh = async () => {
    try {
      toast.info('Refreshing user data...');
      await fetchUsers();
      toast.success('User data refreshed');
    } catch (err) {
      console.error("Error refreshing user data:", err);
      toast.error('Failed to refresh user data. Please try again.');
    }
  };

  // Show loading state
  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center">
            <UsersIcon className="h-6 w-6 mr-2 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          </div>
          <p className="text-gray-500 mt-1">Manage user accounts and permissions</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => navigate("/")}>Back to Dashboard</Button>
        </div>
      </div>

      {/* Show auth debugger for troubleshooting */}
      {user && <AuthDebugger />}

      {/* Display any errors */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2">
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                Try Again
              </Button>
            </div>
          </AlertDescription>
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
