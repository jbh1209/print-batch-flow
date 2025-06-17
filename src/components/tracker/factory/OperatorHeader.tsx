
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogOut, User, KeyRound, Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/tracker/useUserRole";
import { UserProfileSettings } from "@/components/users/UserProfileSettings";
import { cleanupAuthState } from "@/utils/authCleanup";

interface OperatorHeaderProps {
  title?: string;
  showNavigation?: boolean;
  children?: React.ReactNode;
}

export const OperatorHeader: React.FC<OperatorHeaderProps> = ({ 
  title = "Factory Floor", 
  showNavigation = false,
  children
}) => {
  const { user, signOut } = useAuth();
  const { userRole } = useUserRole();
  const [showProfileDialog, setShowProfileDialog] = useState(false);

  const handleLogout = async () => {
    try {
      cleanupAuthState();
      await signOut();
      window.location.href = '/auth';
    } catch (error) {
      console.error('❌ Logout failed:', error);
      // Force cleanup and redirect even if signOut fails
      cleanupAuthState();
      window.location.href = '/auth';
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'dtp_operator': return 'DTP Operator';
      case 'operator': return 'Operator';
      case 'manager': return 'Manager';
      case 'admin': return 'Administrator';
      default: return 'User';
    }
  };

  return (
    <>
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          {userRole && (
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {getRoleDisplayName(userRole)}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {children}
          
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{user.email}</span>
                  <Menu className="h-4 w-4 sm:hidden" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setShowProfileDialog(true)}>
                  <KeyRound className="h-4 w-4 mr-2" />
                  Profile Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Profile Settings</DialogTitle>
          </DialogHeader>
          <UserProfileSettings />
        </DialogContent>
      </Dialog>
    </>
  );
};
