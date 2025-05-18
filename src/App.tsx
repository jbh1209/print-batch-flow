
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider"
import { useAuth, AuthProvider } from "@/contexts/AuthContext";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Users from "@/pages/Users";
import { UserManagementProvider } from "@/contexts/UserManagementContext";

function App() {
  const { user, isLoading } = useAuth();
  const [isFirstAdmin, setIsFirstAdmin] = useState(false);

  useEffect(() => {
    // Check if it's the first admin setup
    if (!user && !isLoading) {
      // Logic to determine if it's the first admin setup
      setIsFirstAdmin(true);
    }
  }, [user, isLoading]);
  
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <Router>
        <AuthProvider>
          <UserManagementProvider>
            <Routes>
              <Route path="/auth" element={user ? <Navigate to="/dashboard" /> : <Auth />} />
              <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/auth" />} />
              <Route path="/users" element={user ? <Users /> : <Navigate to="/auth" />} />
              <Route path="/" element={<Navigate to="/dashboard" />} />
            </Routes>
          </UserManagementProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
