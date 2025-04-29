import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users as UsersIcon, RefreshCcw, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { UserTableContainer } from "@/components/users/UserTableContainer";
import { AdminSetupForm } from "@/components/users/AdminSetupForm";
import { AuthDebugger } from "@/components/users/AuthDebugger";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

// Define User interface to match what we expect from the API
interface User {
  id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  last_sign_in_at?: string;
}

const Users = () => {
  const navigate = useNavigate();
  const { user, isAdmin, checkAdminStatus } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, AppRole>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [anyAdminExists, setAnyAdminExists] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Check if any admin exists in the system
  useEffect(() => {
    const checkAdminExists = async () => {
      try {
        setError(null);
        const { data, error } = await supabase.rpc('any_admin_exists');
          
        if (error) {
          console.error('Error checking admin existence:', error);
          setError(`Error checking if admin exists: ${error.message}`);
          setAnyAdminExists(false);
          return;
        }
        
        setAnyAdminExists(!!data);
      } catch (error: any) {
        console.error('Error in checkAdminExists:', error);
        setError(`Error checking if admin exists: ${error.message}`);
        setAnyAdminExists(false);
      }
    };
    
    checkAdminExists();
  }, [refreshTrigger]);

  // Fetch users and roles
  const fetchUsers = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!isAdmin && anyAdminExists) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch all users with authentication data
      let { data: usersData, error: usersError } = await supabase.functions.invoke('get-users');
      
      if (usersError) throw usersError;
      
      // Get all user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
        
      if (rolesError) throw rolesError;
      
      // Create a map of user_id to role
      const roleMap: Record<string, AppRole> = {};
      if (rolesData) {
        rolesData.forEach((roleEntry) => {
          roleMap[roleEntry.user_id] = roleEntry.role as AppRole;
        });
      }
      
      setUserRoles(roleMap);
      setUsers(usersData || []);
    } catch (error: any) {
      console.error('Error loading users:', error);
      setError(`Error loading users: ${error.message}`);
      toast.error(`Error loading users: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh data manually
  const handleRefresh = async () => {
    setRefreshTrigger(prev => prev + 1);
    await Promise.all([
      fetchUsers(),
      checkAdminStatus()
    ]);
    toast.success("User data refreshed");
  };

  // Call fetchUsers when isAdmin or anyAdminExists changes
  useEffect(() => {
    fetchUsers();
  }, [isAdmin, anyAdminExists, user]);

  if (!user) {
    return null;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center">
            <UsersIcon className="h-6 w-6 mr-2 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Users & Permissions</h1>
          </div>
          <p className="text-gray-500 mt-1">Manage user accounts and administrative privileges</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleRefresh} 
            disabled={isLoading}
          >
            <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => navigate("/")} variant="secondary">Back to Dashboard</Button>
        </div>
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
        <AdminSetupForm refreshUsers={handleRefresh} />
      ) : !isAdmin ? (
        <AccessRestrictedMessage />
      ) : (
        <UserTableContainer 
          users={users} 
          userRoles={userRoles}
          isLoading={isLoading}
          refreshUsers={fetchUsers}
        />
      )}
    </div>
  );
};

// Access restricted message component
const AccessRestrictedMessage = () => (
  <Card>
    <CardContent className="p-6 text-center">
      <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
      <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
      <p className="text-gray-500 mb-4">You need administrator privileges to manage users.</p>
      <p className="text-sm text-gray-400">
        Please contact an administrator if you require access to this page.
      </p>
    </CardContent>
  </Card>
);

export default Users;
