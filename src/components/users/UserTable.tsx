
import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, AlertTriangle, Calendar, Clock } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { UserWithRole } from "@/types/user-types";
import { toast } from "sonner";

interface UserTableProps {
  users: UserWithRole[];
  onEdit: (user: UserWithRole) => void;
  onDelete: (userId: string) => void;
}

export function UserTable({ users, onEdit, onDelete }: UserTableProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Never';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return "bg-red-100 text-red-800 hover:bg-red-100/80";
      case 'moderator':
        return "bg-amber-100 text-amber-800 hover:bg-amber-100/80";
      default:
        return "bg-blue-100 text-blue-800 hover:bg-blue-100/80";
    }
  };

  const handleEdit = (user: UserWithRole) => {
    try {
      onEdit(user);
    } catch (error: any) {
      console.error("Error editing user:", error);
      toast.error(`Error editing user: ${error.message}`);
    }
  };

  const handleDelete = (userId: string) => {
    try {
      onDelete(userId);
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(`Error deleting user: ${error.message}`);
    }
  };

  console.log('UserTable rendering with users:', users);

  const hasUsers = Array.isArray(users) && users.length > 0;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User Details</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Created
              </div>
            </TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!hasUsers ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                <div className="flex flex-col items-center justify-center gap-2">
                  <AlertTriangle className="h-8 w-8 text-amber-500" />
                  <p>No users found</p>
                  <p className="text-sm text-muted-foreground">
                    This could be due to missing user data or permission issues. Try syncing profiles.
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium">{user.full_name || 'No Name'}</div>
                    <div className="text-xs text-muted-foreground">ID: {user.id.slice(0, 8)}...</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-mono text-sm">
                      {user.email === 'Email not available' ? (
                        <span className="text-amber-600 italic">{user.email}</span>
                      ) : (
                        user.email
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={getRoleBadgeColor(user.role)}>
                    {user.role || 'user'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="text-sm">{formatDate(user.created_at)}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleEdit(user)}
                      className="transition-opacity hover:opacity-70"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="transition-opacity hover:opacity-70"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently revoke access for {user.full_name || user.email || 'this user'}. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            className="bg-red-500 hover:bg-red-600"
                            onClick={() => handleDelete(user.id)}
                          >
                            Revoke Access
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
