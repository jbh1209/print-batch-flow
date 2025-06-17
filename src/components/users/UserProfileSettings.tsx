
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { KeyRound, User } from "lucide-react";
import { PasswordChangeForm } from "./PasswordChangeForm";
import { changeUserPassword, PasswordChangeData } from "@/services/passwordService";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export const UserProfileSettings = () => {
  const { user, profile } = useAuth();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  const handlePasswordChange = async (data: PasswordChangeData) => {
    try {
      await changeUserPassword(data);
      toast.success('Password changed successfully');
      setShowPasswordDialog(false);
    } catch (error: any) {
      toast.error(`Failed to change password: ${error.message}`);
      throw error; // Re-throw to show in form
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Email</label>
            <p className="text-sm text-gray-900">{user.email}</p>
          </div>
          
          {profile?.full_name && (
            <div>
              <label className="text-sm font-medium text-gray-700">Full Name</label>
              <p className="text-sm text-gray-900">{profile.full_name}</p>
            </div>
          )}

          <div className="pt-4 border-t">
            <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  Change Password
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Change Password</DialogTitle>
                </DialogHeader>
                <PasswordChangeForm
                  onSubmit={handlePasswordChange}
                  isCurrentUser={true}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
