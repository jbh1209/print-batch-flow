
import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface AuthInitializerProps {
  children: React.ReactNode;
}

export const AuthInitializer: React.FC<AuthInitializerProps> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const [isFirstAdmin, setIsFirstAdmin] = useState(false);
  const [initComplete, setInitComplete] = useState(false);

  useEffect(() => {
    // Check if it's the first admin setup
    if (!isLoading) {
      // Logic to determine if it's the first admin setup
      if (!user) {
        setIsFirstAdmin(true);
      }
      setInitComplete(true);
    }
  }, [user, isLoading]);

  // Show nothing while initializing authentication
  if (!initComplete) {
    return null;
  }

  // Authentication is initialized, render children
  return <>{children}</>;
};
