
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface AdminPasswordResetData {
  userId: string;
  newPassword: string;
}

// Change password for current user
export async function changeUserPassword(passwordData: PasswordChangeData): Promise<void> {
  try {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      throw new Error('New passwords do not match');
    }

    if (passwordData.newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }

    const { error } = await supabase.auth.updateUser({
      password: passwordData.newPassword
    });

    if (error) {
      throw new Error(error.message);
    }

    console.log('✅ Password changed successfully');
  } catch (error) {
    console.error('❌ Error changing password:', error);
    throw error;
  }
}

// Admin function to reset any user's password
export async function resetUserPasswordAdmin(resetData: AdminPasswordResetData): Promise<void> {
  try {
    if (resetData.newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    console.log('🔄 Admin resetting password for user:', resetData.userId);

    const { data, error } = await supabase.functions.invoke('reset-user-password-admin', {
      body: {
        userId: resetData.userId,
        newPassword: resetData.newPassword
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error(error.message || 'Failed to reset password');
    }

    console.log('✅ Password reset successfully by admin');
  } catch (error: any) {
    console.error('❌ Error resetting password:', error);
    throw new Error(error.message || 'Failed to reset password');
  }
}

// Send password reset email
export async function sendPasswordResetEmail(email: string): Promise<void> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?mode=reset`
    });

    if (error) {
      throw new Error(error.message);
    }

    console.log('✅ Password reset email sent');
  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    throw error;
  }
}
