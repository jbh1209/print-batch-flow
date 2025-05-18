
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserManagement } from "@/contexts/UserManagementContext";
import { UsersHeader } from "@/components/users/UsersHeader";
import { ErrorAlert } from "@/components/users/ErrorAlert";
import { LoadingState } from "@/components/users/LoadingState";
import { InitialAdminSetup } from "@/components/users/InitialAdminSetup";
import { AccessRestricted } from "@/components/users/AccessRestricted";
import { UsersTable } from "@/components/users/UsersTable";

const Users = () => {
  const { isAdmin } = useAuth();
  const {
    users,
    isLoading,
    error,
    anyAdminExists,
    fetchUsers,
    checkAdminExists,
  } = useUserManagement();

  // Check if any admin exists on component mount
  useEffect(() => {
    checkAdminExists();
    fetchUsers();
  }, [checkAdminExists, fetchUsers]);

  // Handle refresh users
  const handleRefresh = async () => {
    try {
      await fetchUsers();
    } catch (err) {
      console.error("Error refreshing users:", err);
    }
  };

  return (
    <div>
      <UsersHeader onRefresh={handleRefresh} />

      {/* Display errors */}
      {error && <ErrorAlert error={error} onRetry={handleRefresh} />}

      {isLoading ? (
        <LoadingState />
      ) : !anyAdminExists ? (
        <InitialAdminSetup />
      ) : !isAdmin ? (
        <AccessRestricted />
      ) : (
        <UsersTable users={users} />
      )}
    </div>
  );
};

export default Users;
