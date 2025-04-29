
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Users as UsersIcon, UserPlus, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
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

  // Fetch all users and their roles
  useEffect(() => {
    const fetchUsers = async () => {
      if (!isAdmin) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      
      // First get all users
      const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
      
      if (userError) {
        console.error('Error fetching users:', userError);
        setIsLoading(false);
        return;
      }
      
      if (userData && userData.users) {
        // Get all user roles to map them to users
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id, role');
          
        if (rolesError) {
          console.error('Error fetching user roles:', rolesError);
        }
        
        // Create a map of user_id to role
        const roleMap: Record<string, string> = {};
        if (rolesData) {
          rolesData.forEach((roleEntry) => {
            roleMap[roleEntry.user_id] = roleEntry.role;
          });
        }
        
        setUserRoles(roleMap);
        setUsers(userData.users);
      }
      
      setIsLoading(false);
    };
    
    fetchUsers();
  }, [isAdmin]);

  const handleAddUser = async (userData: any) => {
    try {
      // Create the user with Supabase Auth
      const { data, error } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
      });
      
      if (error) throw error;
      
      if (data.user) {
        // Assign role to the new user
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert([
            { user_id: data.user.id, role: userData.role || 'user' }
          ]);
          
        if (roleError) throw roleError;
        
        toast.success('User created successfully');
        setDialogOpen(false);
        
        // Refresh the user list
        const { data: updatedUsers } = await supabase.auth.admin.listUsers();
        if (updatedUsers) {
          setUsers(updatedUsers.users);
        }
      }
    } catch (error: any) {
      toast.error(`Error creating user: ${error.message}`);
    }
  };

  const handleEditUser = async (userData: any) => {
    try {
      if (!editingUser) return;
      
      // Update user details
      const { error } = await supabase.auth.admin.updateUserById(
        editingUser.id,
        { email: userData.email }
      );
      
      if (error) throw error;
      
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
      
      toast.success('User updated successfully');
      setDialogOpen(false);
      setEditingUser(null);
      
      // Refresh the user list
      const { data: updatedUsers } = await supabase.auth.admin.listUsers();
      if (updatedUsers) {
        setUsers(updatedUsers.users);
      }
      
      // Refresh roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');
        
      if (rolesData) {
        const roleMap: Record<string, string> = {};
        rolesData.forEach((roleEntry) => {
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
      // Delete user from Supabase Auth
      const { error } = await supabase.auth.admin.deleteUser(userId);
      
      if (error) throw error;
      
      toast.success('User deleted successfully');
      
      // Update local state to remove the deleted user
      setUsers(users.filter(u => u.id !== userId));
    } catch (error: any) {
      toast.error(`Error deleting user: ${error.message}`);
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
          onEdit={openEditDialog}
          onDelete={handleDeleteUser}
        />
      )}
    </div>
  );
};

export default Users;
