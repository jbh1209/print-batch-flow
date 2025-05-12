
import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { UserFormData, UserWithRole } from "@/types/user-types";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserForm } from "./UserForm";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UserDialogFormProps {
  onSubmit: (userData: UserFormData) => Promise<void>;
  editingUser: UserWithRole | null;
  error: string | null;
  isProcessing: boolean;
}

export function UserDialogForm({ 
  onSubmit, 
  editingUser, 
  error, 
  isProcessing 
}: UserDialogFormProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {editingUser ? 'Edit User' : 'Add New User'}
        </DialogTitle>
      </DialogHeader>
      
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <UserForm 
        initialData={editingUser ? {
          email: editingUser.email,
          full_name: editingUser.full_name || '',
          role: editingUser.role
        } : undefined}
        onSubmit={onSubmit}
        isEditing={!!editingUser}
        isProcessing={isProcessing}
      />
    </>
  );
}
