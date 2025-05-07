
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users as UsersIcon, AlertCircle, RefreshCw, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserTable } from '@/components/users/UserTable';
import { UserForm } from '@/components/users/UserForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { UserProvider, useUsers } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { AdminSetupForm } from '@/components/users/AdminSetupForm';

// Separate the content from the provider
const UsersContent = () => {
  const { user, isAdmin, signOut } = useAuth();
  const { users, isLoading, error, refetchUsers, checkAdminExists } = useUsers();
  const [anyAdminExists, setAnyAdminExists] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();

  // Check if any admin exists
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) return;
      
      try {
        const exists = await checkAdminExists();
        setAnyAdminExists(exists);
      } catch (err) {
        console.error('Error checking admin existence:', err);
      }
    };
    
    checkAdmin();
  }, [user, checkAdminExists]);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      window.location.href = '/auth';
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Users</h2>
            <p className="text-muted-foreground">Manage user access and permissions</p>
          </div>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-gray-200 rounded w-1/2"></div>
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // No admin setup
  if (!anyAdminExists) {
    return <AdminSetupForm onAdminCreated={() => setAnyAdminExists(true)} />;
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="flex-1 space-y-4 p-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Users</h2>
            <p className="text-muted-foreground">Manage user access and permissions</p>
          </div>
          <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
        </div>
        
        <Alert variant="default" className="bg-yellow-50 border-yellow-200">
          <AlertCircle className="h-4 w-4 text-yellow-800" />
          <AlertTitle className="text-yellow-800">Access Restricted</AlertTitle>
          <AlertDescription className="text-yellow-700">
            You need administrator privileges to view this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4">
      {/* Header with title and actions */}
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <UsersIcon className="mr-2 h-5 w-5" />
          <div>
            <h2 className="text-2xl font-bold">Users</h2>
            <p className="text-muted-foreground">Manage user access and permissions</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={() => refetchUsers()} className="flex items-center">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
        </div>
      </div>

      {/* Display errors if any */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={() => refetchUsers()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
              <Button variant="destructive" size="sm" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* User management interface */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Add, edit or remove users and their permissions</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>Add User</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
              </DialogHeader>
              <UserForm 
                onSuccess={() => {
                  setDialogOpen(false);
                  refetchUsers();
                }} 
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <UserTable users={users} />
        </CardContent>
      </Card>
    </div>
  );
};

// Main component with provider
const Users = () => {
  return (
    <UserProvider>
      <UsersContent />
    </UserProvider>
  );
};

export default Users;
