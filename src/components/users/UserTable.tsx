
import React, { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  MoreHorizontal, 
  Pencil, 
  Trash, 
  ShieldAlert,
  User,
  AlertCircle
} from 'lucide-react';
import { UserWithRole } from '@/types/user-types';
import { UserForm } from './UserForm';
import { UserDeleteConfirm } from './UserDeleteConfirm';
import { format } from 'date-fns';
import { useUsers } from '@/contexts/UserContext';

interface UserTableProps {
  users: UserWithRole[];
}

export function UserTable({ users }: UserTableProps) {
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [dialogMode, setDialogMode] = useState<'edit' | 'delete' | null>(null);
  const { updateUser, revokeAccess } = useUsers();
  
  const handleCloseDialog = () => {
    setSelectedUser(null);
    setDialogMode(null);
  };
  
  const handleEditClick = (user: UserWithRole) => {
    setSelectedUser(user);
    setDialogMode('edit');
  };
  
  const handleDeleteClick = (user: UserWithRole) => {
    setSelectedUser(user);
    setDialogMode('delete');
  };
  
  const handleUpdateUser = async (userData: { full_name?: string; role?: string }) => {
    if (!selectedUser) return;
    
    try {
      await updateUser(selectedUser.id, userData);
      handleCloseDialog();
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };
  
  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    try {
      await revokeAccess(selectedUser.id);
      handleCloseDialog();
    } catch (error) {
      console.error('Error revoking access:', error);
    }
  };
  
  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <User className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No users found</h3>
        <p className="text-muted-foreground">There are no users to display.</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.full_name || <span className="text-muted-foreground italic">Not set</span>}
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                    {user.role === 'admin' ? (
                      <div className="flex items-center">
                        <ShieldAlert className="mr-1 h-3 w-3" />
                        Admin
                      </div>
                    ) : 'User'}
                  </Badge>
                </TableCell>
                <TableCell>{format(new Date(user.created_at), 'MMM d, yyyy')}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditClick(user)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteClick(user)}>
                        <Trash className="mr-2 h-4 w-4" />
                        Revoke Access
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {/* Edit User Dialog */}
      <Dialog open={dialogMode === 'edit'} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <UserForm 
              initialData={{
                full_name: selectedUser.full_name || '',
                role: selectedUser.role
              }}
              isEdit={true}
              onSuccess={handleUpdateUser}
            />
          )}
        </DialogContent>
      </Dialog>
      
      {/* Delete User Dialog */}
      <Dialog open={dialogMode === 'delete'} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center text-destructive">
              <AlertCircle className="mr-2 h-5 w-5" />
              Revoke User Access
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <UserDeleteConfirm 
              user={selectedUser} 
              onConfirm={handleDeleteUser} 
              onCancel={handleCloseDialog}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
