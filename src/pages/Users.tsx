
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users as UsersIcon, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { UserTableContainer } from "@/components/users/UserTableContainer";
import { AdminSetupForm } from "@/components/users/AdminSetupForm";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthDebugger } from "@/components/users/AuthDebugger";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Users = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});
  const [anyAdminExists, setAnyAdminExists] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          setIsLoading(false);
          return;
        }
        
        setAnyAdminExists(data);
        setIsLoading(false);
      } catch (error: any) {
        console.error('Error in checkAdminExists:', error);
        setError(`Error checking if admin exists: ${error.message}`);
        setAnyAdminExists(false);
        setIsLoading(false);
      }
    };
    
    checkAdminExists();
  }, []);

  // Fetch users and profiles when needed
  const fetchUsers = async () => {
    if (!isAdmin && anyAdminExists) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Get all user profiles
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, created_at');
      
      if (profileError) throw profileError;
      
      // Create a map of user profiles
      const profileMap: Record<string, any> = {};
      if (profileData) {
        profileData.forEach((profile) => {
          profileMap[profile.id] = profile;
        });
      }
      
      setUserProfiles(profileMap);
      
      // Get all user roles using RPC function to avoid recursion
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
        
      if (rolesError) throw rolesError;
      
      // Create a map of user_id to role
      const roleMap: Record<string, string> = {};
      if (rolesData) {
        rolesData.forEach((roleEntry) => {
          roleMap[roleEntry.user_id] = roleEntry.role;
        });
      }
      
      setUserRoles(roleMap);
      
      // Format user data to match expected structure
      const formattedUsers = profileData?.map(profile => ({
        id: profile.id,
        full_name: profile.full_name,
        email: '', // We don't have direct access to emails
        created_at: profile.created_at,
        last_sign_in_at: null
      })) || [];
      
      setUsers(formattedUsers);
    } catch (error: any) {
      console.error('Error loading users:', error);
      setError(`Error loading users: ${error.message}`);
      toast.error(`Error loading users: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Call fetchUsers when isAdmin or anyAdminExists changes
  useEffect(() => {
    fetchUsers();
  }, [isAdmin, anyAdminExists]);

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
        <UserTableContainer 
          users={users} 
          userRoles={userRoles}
          userProfiles={userProfiles}
          refreshUsers={fetchUsers}
        />
      )}
    </div>
  );
};

// Loading state component
const LoadingState = () => (
  <div>
    <div className="flex justify-between items-center mb-6">
      <div>
        <div className="flex items-center">
          <Skeleton className="h-6 w-6 mr-2" />
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-4 w-60 mt-1" />
      </div>
      <Skeleton className="h-10 w-36" />
    </div>
    <div className="border rounded-md">
      <div className="p-4">
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  </div>
);

// Access restricted message component
const AccessRestrictedMessage = () => (
  <Card>
    <CardContent className="p-6 text-center">
      <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
      <p className="text-gray-500">You need administrator privileges to manage users.</p>
    </CardContent>
  </Card>
);

export default Users;
