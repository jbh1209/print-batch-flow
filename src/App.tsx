
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/auth/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import { TrackerErrorBoundary } from "@/components/tracker/TrackerErrorBoundary";
import RoleAwareLayout from "@/components/tracker/RoleAwareLayout";
import Auth from "@/pages/Auth";
import BusinessCardJobs from "@/pages/BusinessCardJobs";
import Users from "@/pages/Users";

import "./App.css";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <TrackerErrorBoundary>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/" element={<Navigate to="/auth" replace />} />
                <Route path="/business-cards" element={
                  <ProtectedRoute>
                    <BusinessCardJobs />
                  </ProtectedRoute>
                } />
                <Route path="/tracker/*" element={
                  <ProtectedRoute>
                    <Routes>
                      <Route index element={<Navigate to="jobs" replace />} />
                      <Route path="*" element={<RoleAwareLayout />} />
                    </Routes>
                  </ProtectedRoute>
                } />
                <Route path="/users" element={
                  <ProtectedRoute>
                    <Users />
                  </ProtectedRoute>
                } />
              </Routes>
            </TrackerErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
