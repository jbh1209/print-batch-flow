
import React, { useEffect } from 'react';
import { UserTableContainer } from '@/components/users/UserTableContainer';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { useUserManagement } from '@/hooks/useUserManagement';

const UsersPage = () => {
  const { isAdmin, isLoading: authLoading, refreshProfile } = useAuth();
  const { fetchUsers, isLoading: usersLoading } = useUserManagement();
  
  // First refresh profile to ensure admin status is up-to-date
  useEffect(() => {
    const checkAdminStatus = async () => {
      await refreshProfile();
    };
    checkAdminStatus();
  }, [refreshProfile]);
  
  // Then, explicitly fetch users data ONLY on the users page when it loads
  useEffect(() => {
    if (isAdmin) {
      console.log('Users page - explicitly fetching user data');
      fetchUsers().catch(error => {
        console.error("User management error:", error);
        const message = error?.message || "An unexpected error occurred";
        toast.error(message);
      });
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
      </div>
      <UserTableContainer />
    </div>
  );
};

export default UsersPage;
