
import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserManagementProvider } from "@/contexts/UserManagementContext";
import { ProtectedRoutes } from "@/components/auth/ProtectedRoutes";

function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <Router>
          <UserManagementProvider>
            <ProtectedRoutes />
          </UserManagementProvider>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
