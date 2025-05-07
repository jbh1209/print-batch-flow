
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users as UsersIcon, AlertTriangle, RefreshCw, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AuthDebugger } from "@/components/users/AuthDebugger";
import { UserManagementProvider, useUserManagement } from "@/contexts/user/UserManagementContext";
import { AdminSetupForm } from "@/components/users/AdminSetupForm";
import { UserTableContainer } from "@/components/users/UserTableContainer";
import { LoadingState } from "@/components/users/LoadingState";
import { AccessRestrictedMessage } from "@/components/users/AccessRestrictedMessage";
import { toast } from "sonner";

// Main content component separated from provider setup
const UsersContent = () => {
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const [authIssue, setAuthIssue] = useState<boolean>(false);
  
  const { 
    error, 
    isLoading, 
    anyAdminExists, 
    checkAdminExists,
    fetchUsers
  } = useUserManagement();

  // Check if any admin exists when component mounts
  useEffect(() => {
    let mounted = true;
    
    const initializeCheck = async () => {
      if (!user?.id) return;
      
      try {
        if (mounted) {
          await checkAdminExists();
        }
      } catch (err) {
        console.error("Failed to check admin existence:", err);
        if (mounted) {
          toast.error("Failed to check if admin exists. Please try again.");
        }
      }
    };
    
    initializeCheck();
    
    return () => {
      mounted = false;
    };
  }, [user?.id, checkAdminExists]);

  // Load users when admin status changes
  useEffect(() => {
    let mounted = true;
    
    if (isAdmin && user?.id && mounted) {
      fetchUsers().catch(err => {
        if (mounted) {
          console.error("Failed to fetch users:", err);
        }
      });
    }
    
    return () => {
      mounted = false;
    };
  }, [isAdmin, user?.id, fetchUsers]);

  // Monitor errors for authentication issues
  useEffect(() => {
    if (error && (
      error.includes('session') || 
      error.includes('Authentication') || 
      error.includes('expired'))) {
      setAuthIssue(true);
    } else {
      setAuthIssue(false);
    }
  }, [error]);

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

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logged out successfully');
      navigate('/auth');
    } catch (err) {
      console.error("Error signing out:", err);
      toast.error('Failed to sign out. Please try again.');
      window.location.reload();
    }
  };

  // Show loading state
  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div>
      {/* Header content */}
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

      {/* Authentication issue alert with helpful actions */}
      {authIssue && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Authentication Problem</AlertTitle>
          <AlertDescription>
            <p>{error}</p>
            <div className="mt-3 flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                className="flex items-center gap-1"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleLogout}
                className="flex items-center gap-1"
              >
                <LogOut className="h-4 w-4" />
                Log Out
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Display other errors */}
      {error && !authIssue && (
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
