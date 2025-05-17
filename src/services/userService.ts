import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// These are the supported RPC function names based on the error messages
const supportedFunctions = [
  'any_admin_exists',
  'get_all_users',
  'get_all_users_secure',
  'get_all_users_with_roles',
  'is_admin_secure_fixed'
];

export const checkIsAdmin = async (userId: string): Promise<boolean> => {
  try {
    // Updated RPC function name to is_admin_secure_fixed
    const { data, error } = await supabase.rpc('is_admin_secure_fixed', { user_id: userId });
    
    if (error) {
      console.error("Error checking if user is admin:", error);
      return false;
    }
    
    return data === true;
  } catch (err) {
    console.error("Exception checking if user is admin:", err);
    return false;
  }
};

export const checkIsAdminFallback = async (userId: string): Promise<boolean> => {
  try {
    // Try the fallback method if the secure method fails
    const { data, error } = await supabase.rpc('is_admin_secure_fixed', { user_id: userId });
    
    if (error) {
      console.error("Error checking if user is admin (fallback):", error);
      return false;
    }
    
    return data === true;
  } catch (err) {
    console.error("Exception checking if user is admin (fallback):", err);
    return false;
  }
};

export const checkAdminExists = async (): Promise<boolean> => {
  try {
    // This function name is supported, no need to change
    const { data, error } = await supabase.rpc('any_admin_exists');
    
    if (error) {
      console.error("Error checking if admin exists:", error);
      return false;
    }
    
    return data === true;
  } catch (err) {
    console.error("Exception checking if admin exists:", err);
    return false;
  }
};

export const fetchUsers = async () => {
  try {
    const { data, error } = await supabase.rpc('get_all_users_with_roles');
    
    if (error) {
      console.error("Error fetching users:", error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error("Exception fetching users:", err);
    return [];
  }
};

export const getAllUsers = async () => {
  try {
    const { data, error } = await supabase.rpc('get_all_users');
    
    if (error) {
      console.error("Error getting all users:", error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error("Exception getting all users:", err);
    return [];
  }
};

export const getAllUsersSecure = async () => {
  try {
    const { data, error } = await supabase.rpc('get_all_users_secure');
    
    if (error) {
      console.error("Error getting all users securely:", error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error("Exception getting all users securely:", err);
    return [];
  }
};

// Here's a utility function to handle RPC errors consistently:
const handleRpcError = (error: any, defaultReturnValue: any, message: string): any => {
  console.error(message, error);
  toast.error(`Error: ${message}`);
  return defaultReturnValue;
};

// For the export function, replace the actual implementation with this:
export const setUserRole = async (userId: string, role: string): Promise<boolean> => {
  try {
    // We should use one of the supported functions or create a new one
    // For now, let's use a direct table operation instead of RPC
    const { error } = await supabase
      .from('user_roles')
      .upsert({ user_id: userId, role }, { onConflict: 'user_id' });
      
    if (error) throw error;
    
    toast.success(`User role updated to ${role}`);
    return true;
  } catch (err) {
    return handleRpcError(err, false, "Failed to update user role");
  }
};

// Similar approach for revokeUserRole
export const revokeUserRole = async (userId: string, role: string): Promise<boolean> => {
  try {
    // Direct table operation instead of RPC
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', role);
      
    if (error) throw error;
    
    toast.success(`User role ${role} revoked`);
    return true;
  } catch (err) {
    return handleRpcError(err, false, "Failed to revoke user role");
  }
};

// For addAdminRole function
export const addAdminRole = async (userId: string): Promise<boolean> => {
  return setUserRole(userId, 'admin');
};

// Function to check if a user has a specific role
export const checkUserHasRole = async (userId: string, role: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('role', role)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No record found
        return false;
      }
      throw error;
    }
    
    return !!data;
  } catch (err) {
    console.error(`Error checking if user has role ${role}:`, err);
    return false;
  }
};

// Function to get all roles for a user
export const getUserRoles = async (userId: string): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    
    if (error) throw error;
    
    return (data || []).map(item => item.role);
  } catch (err) {
    console.error("Error getting user roles:", err);
    return [];
  }
};

// Function to check if a user is a manager
export const checkIsManager = async (userId: string): Promise<boolean> => {
  return checkUserHasRole(userId, 'manager');
};

// Function to check if a user is a printer
export const checkIsPrinter = async (userId: string): Promise<boolean> => {
  return checkUserHasRole(userId, 'printer');
};

// Function to add manager role
export const addManagerRole = async (userId: string): Promise<boolean> => {
  return setUserRole(userId, 'manager');
};

// Function to add printer role
export const addPrinterRole = async (userId: string): Promise<boolean> => {
  return setUserRole(userId, 'printer');
};

// Function to revoke manager role
export const revokeManagerRole = async (userId: string): Promise<boolean> => {
  return revokeUserRole(userId, 'manager');
};

// Function to revoke printer role
export const revokePrinterRole = async (userId: string): Promise<boolean> => {
  return revokeUserRole(userId, 'printer');
};

// Function to revoke admin role
export const revokeAdminRole = async (userId: string): Promise<boolean> => {
  return revokeUserRole(userId, 'admin');
};
