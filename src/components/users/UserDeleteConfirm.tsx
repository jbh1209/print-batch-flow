
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserWithRole } from '@/types/user-types';
import { Loader2 } from 'lucide-react';

interface UserDeleteConfirmProps {
  user: UserWithRole;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function UserDeleteConfirm({ user, onConfirm, onCancel }: UserDeleteConfirmProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };
  
  return (
    <div className="space-y-4">
      <p>
        Are you sure you want to revoke access for{' '}
        <strong>{user.full_name || user.email}</strong>?
      </p>
      
      <p className="text-sm text-muted-foreground">
        This will remove the user's role and they will no longer have access to the system. 
        This action cannot be undone.
      </p>
      
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
          {isDeleting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Revoking...
            </>
          ) : (
            'Revoke Access'
          )}
        </Button>
      </div>
    </div>
  );
}
