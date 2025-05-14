
import React, { useCallback, useEffect } from 'react';
import { UserTableContainer } from '@/components/users/UserTableContainer';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { useUserManagement } from '@/hooks/useUserManagement';

const UsersPage = () => {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { fetchUsers, isLoading: usersLoading } = useUserManagement();
  
  // Explicitly fetch users data when the button is clicked
  const handleFetchUsers = useCallback(async () => {
    if (isAdmin) {
      try {
        console.log('Users page - explicitly fetching user data');
        await fetchUsers();
      } catch (error: any) {
        console.error("User management error:", error);
        const message = error?.message || "An unexpected error occurred";
        toast.error(message);
      }
    }
  }, [isAdmin, fetchUsers]);

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="container mx-auto py-6 flex justify-center items-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect if not admin
  if (!isAdmin) {
    toast.error("You don't have permission to access this page");
    return <Navigate to="/" />;
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">User Management</h1>
        <button 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={handleFetchUsers}
          disabled={usersLoading}
        >
          {usersLoading ? "Loading..." : "Load Users"}
        </button>
      </div>
      <UserTableContainer />
    </div>
  );
};

export default UsersPage;
