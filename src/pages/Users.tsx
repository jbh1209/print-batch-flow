
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users as UsersIcon, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { UserForm } from "@/components/users/UserForm";
import { UserTable } from "@/components/users/UserTable";

const Users = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});

  // Check if current user is admin
  useEffect(() => {
    if (!user) return;
    
    const checkAdminRole = async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .eq('role', 'admin');
        
      if (error) {
        console.error('Error checking admin role:', error);
        return;
      }
      
      setIsAdmin(data && data.length > 0);
    };
    
    checkAdminRole();
  }, [user]);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      if (!isAdmin || !user) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      
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
        
        // Get all user roles
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
        console.error('Error fetching users:', error);
        toast.error('Error loading users');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUsers();
  }, [isAdmin, user]);

  const handleAddUser = async (userData: any) => {
    try {
      // Sign up the user with Supabase auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: userData.full_name
          }
        }
      });
      
      if (authError) throw authError;
      
      if (authData.user) {
        // Assign role to the new user
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert([
            { user_id: authData.user.id, role: userData.role || 'user' }
          ]);
          
        if (roleError) throw roleError;
        
        toast.success('User created successfully');
        setDialogOpen(false);
        
        // Refresh the user list
        const { data: refreshedProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, created_at');
        
        if (refreshedProfiles) {
          const formattedUsers = refreshedProfiles.map(profile => ({
            id: profile.id,
            full_name: profile.full_name,
            email: '', // We don't have direct access to emails
            created_at: profile.created_at,
            last_sign_in_at: null
          }));
          
          setUsers(formattedUsers);
          
          // Update profiles map
          const profileMap: Record<string, any> = {};
          refreshedProfiles.forEach((profile) => {
            profileMap[profile.id] = profile;
          });
          
          setUserProfiles(profileMap);
        }
        
        // Refresh roles
        const { data: refreshedRoles } = await supabase
          .from('user_roles')
          .select('user_id, role');
          
        if (refreshedRoles) {
          const roleMap: Record<string, string> = {};
          refreshedRoles.forEach((roleEntry) => {
            roleMap[roleEntry.user_id] = roleEntry.role;
          });
          setUserRoles(roleMap);
        }
      }
    } catch (error: any) {
      toast.error(`Error creating user: ${error.message}`);
    }
  };

  const handleEditUser = async (userData: any) => {
    try {
      if (!editingUser) return;
      
      // Update role if changed
      if (userData.role && userRoles[editingUser.id] !== userData.role) {
        // Delete existing role
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', editingUser.id);
          
        // Insert new role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert([
            { user_id: editingUser.id, role: userData.role }
          ]);
          
        if (roleError) throw roleError;
      }
      
      // Update user profile if name changed
      if (userData.full_name && userData.full_name !== editingUser.full_name) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ full_name: userData.full_name })
          .eq('id', editingUser.id);
          
        if (profileError) throw profileError;
      }
      
      toast.success('User updated successfully');
      setDialogOpen(false);
      setEditingUser(null);
      
      // Refresh profiles
      const { data: refreshedProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, created_at');
      
      if (refreshedProfiles) {
        const formattedUsers = refreshedProfiles.map(profile => ({
          id: profile.id,
          full_name: profile.full_name,
          email: '', // We don't have direct access to emails
          created_at: profile.created_at,
          last_sign_in_at: null
        }));
        
        setUsers(formattedUsers);
        
        // Update profiles map
        const profileMap: Record<string, any> = {};
        refreshedProfiles.forEach((profile) => {
          profileMap[profile.id] = profile;
        });
        
        setUserProfiles(profileMap);
      }
      
      // Refresh roles
      const { data: refreshedRoles } = await supabase
        .from('user_roles')
        .select('user_id, role');
        
      if (refreshedRoles) {
        const roleMap: Record<string, string> = {};
        refreshedRoles.forEach((roleEntry) => {
          roleMap[roleEntry.user_id] = roleEntry.role;
        });
        setUserRoles(roleMap);
      }
    } catch (error: any) {
      toast.error(`Error updating user: ${error.message}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      // We can't delete users directly using the client API
      // Instead, disable their access by revoking their role
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
        
      if (error) throw error;
      
      toast.success('User role revoked successfully');
      
      // Update local state to reflect changes
      const updatedRoles = { ...userRoles };
      delete updatedRoles[userId];
      setUserRoles(updatedRoles);
    } catch (error: any) {
      toast.error(`Error removing user role: ${error.message}`);
    }
  };

  const openEditDialog = (user: any) => {
    setEditingUser(user);
    setDialogOpen(true);
  };

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
        <div className="flex gap-4">
          {isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingUser(null)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingUser ? 'Edit User' : 'Add New User'}
                  </DialogTitle>
                </DialogHeader>
                <UserForm 
                  initialData={editingUser ? {
                    email: editingUser.email,
                    full_name: editingUser.full_name,
                    role: userRoles[editingUser.id] || 'user'
                  } : undefined}
                  onSubmit={editingUser ? handleEditUser : handleAddUser}
                  isEditing={!!editingUser}
                />
              </DialogContent>
            </Dialog>
          )}
          <Button onClick={() => navigate("/")}>Back to Dashboard</Button>
        </div>
      </div>

      {!isAdmin ? (
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
            <p className="text-gray-500">You need administrator privileges to manage users.</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Loading users...</h2>
          </CardContent>
        </Card>
      ) : (
        <UserTable 
          users={users} 
          userRoles={userRoles}
          userProfiles={userProfiles}
          onEdit={openEditDialog}
          onDelete={handleDeleteUser}
        />
      )}
    </div>
  );
};

export default Users;
