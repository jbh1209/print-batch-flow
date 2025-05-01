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
import { Edit, Trash2, UserCheck, UserX } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { User } from "@/types/user-types";

interface UserTableProps {
  users: User[];
  userRoles: Record<string, string>;
  onEdit: (user: User) => void;
  onDelete: (userId: string) => void;
  onRoleToggle: (userId: string, currentRole: string) => void;
  currentUserId: string | undefined;
  isLoading: boolean;
}

export function UserTable({ 
  users, 
  userRoles, 
  onEdit, 
  onDelete, 
  onRoleToggle, 
  currentUserId,
  isLoading
}: UserTableProps) {
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getAvatarColor = (name?: string) => {
    if (!name) return "bg-gray-400";
    const colors = [
      "bg-blue-500", "bg-green-500", "bg-yellow-500", 
      "bg-red-500", "bg-purple-500", "bg-pink-500"
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  const getRoleBadge = (role: string, userId: string) => {
    const isCurrentUser = userId === currentUserId;
    
    switch (role?.toLowerCase()) {
      case 'admin':
        return (
          <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100/80 border-red-200">
            Admin
          </Badge>
        );
      case 'moderator':
        return (
          <Badge variant="outline" className="bg-amber-100 text-amber-800 hover:bg-amber-100/80 border-amber-200">
            Moderator
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100/80 border-blue-200">
            User
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 py-4">
        {Array(3).fill(0).map((_, i) => (
          <div key={i} className="w-full h-14 bg-gray-100 animate-pulse rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last Sign In</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                <div className="flex flex-col items-center justify-center text-gray-500">
                  <p>No users found</p>
                  <p className="text-sm">Add users to get started</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => {
              const userRole = userRoles[user.id] || 'user';
              const isCurrentUser = user.id === currentUserId;
              
              return (
                <TableRow key={user.id} className={isCurrentUser ? "bg-blue-50/30" : ""}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={user.avatar_url || ''} alt={user.full_name || 'User'} />
                        <AvatarFallback className={getAvatarColor(user.full_name)}>
                          {getInitials(user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{user.full_name || 'No Name'}</div>
                        {isCurrentUser && (
                          <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200">
                            You
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{user.email || 'No Email'}</TableCell>
                  <TableCell>
                    {getRoleBadge(userRole, user.id)}
                  </TableCell>
                  <TableCell>{formatDate(user.created_at)}</TableCell>
                  <TableCell>{user.last_sign_in_at ? formatDate(user.last_sign_in_at) : 'Never'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => onEdit(user)}
                              disabled={isLoading}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">Edit user</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      {!isCurrentUser && (
                        <>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => onRoleToggle(user.id, userRole)}
                                  disabled={isLoading}
                                >
                                  {userRole === 'admin' ? (
                                    <UserX className="h-4 w-4 text-amber-600" />
                                  ) : (
                                    <UserCheck className="h-4 w-4 text-green-600" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                {userRole === 'admin' ? 'Remove admin rights' : 'Make admin'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <AlertDialog>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" disabled={isLoading}>
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent side="left">Delete user</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the user {user.full_name || user.email} and revoke their access. 
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  className="bg-red-500 hover:bg-red-600"
                                  onClick={() => onDelete(user.id)}
                                >
                                  Delete User
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
