
import React from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import ProtectedRoute from "./components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AppSelector from "./pages/AppSelector";

// Tracker imports
import TrackerDashboard from "./pages/tracker/TrackerDashboard";
import TrackerJobs from "./pages/tracker/TrackerJobs";
import TrackerProduction from "./pages/tracker/TrackerProduction";
import TrackerKanban from "./pages/tracker/TrackerKanban";
import TrackerWorkSheets from "./pages/tracker/TrackerWorkSheets";
import TrackerAdmin from "./pages/tracker/TrackerAdmin";
import TrackerUsers from "./pages/tracker/TrackerUsers";
import TrackerUpload from "./pages/tracker/TrackerUpload";
import TrackerLabels from "./pages/tracker/TrackerLabels";
import FactoryFloor from "./pages/tracker/FactoryFloor";
import MobileFactory from "./pages/tracker/MobileFactory";
import TrackerMobileScanner from "./pages/tracker/TrackerMobileScanner";
import TrackerAnalytics from "./pages/tracker/TrackerAnalytics";
import RoleAwareLayout from "./components/tracker/RoleAwareLayout";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              
              {/* Protected app selector */}
              <Route path="/apps" element={
                <ProtectedRoute>
                  <AppSelector />
                </ProtectedRoute>
              } />

              {/* Tracker routes with role-aware layout */}
              <Route path="/tracker" element={
                <ProtectedRoute>
                  <RoleAwareLayout />
                </ProtectedRoute>
              }>
                <Route index element={<TrackerDashboard />} />
                <Route path="jobs" element={<TrackerJobs />} />
                <Route path="production" element={<TrackerProduction />} />
                <Route path="kanban" element={<TrackerKanban />} />
                <Route path="worksheets" element={<TrackerWorkSheets />} />
                <Route path="admin" element={<TrackerAdmin />} />
                <Route path="users" element={<TrackerUsers />} />
                <Route path="upload" element={<TrackerUpload />} />
                <Route path="labels" element={<TrackerLabels />} />
                <Route path="factory-floor" element={<FactoryFloor />} />
                <Route path="mobile" element={<MobileFactory />} />
                <Route path="mobile-scanner" element={<TrackerMobileScanner />} />
                <Route path="analytics" element={<TrackerAnalytics />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
