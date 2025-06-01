
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import { supabase } from "./integrations/supabase/client";
import "./App.css";
import TrackerDashboard from "./pages/tracker/TrackerDashboard";
import TrackerJobs from "./pages/tracker/TrackerJobs";
import TrackerLabels from "./pages/tracker/TrackerLabels";
import TrackerUpload from "./pages/tracker/TrackerUpload";
import { AuthProvider } from "./hooks/useAuth";
import { Toaster } from "sonner";
import TrackerMobileScanner from "./pages/tracker/TrackerMobileScanner";
import FactoryFloor from "./pages/tracker/FactoryFloor";
import Auth from "./pages/Auth";
import AppSelector from "./pages/AppSelector";

function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    if (!session) {
      return <Navigate to="/auth" />;
    }

    return <>{children}</>;
  };

  return (
    <AuthProvider>
      <div className="App">
        <Toaster richColors />
        <Router>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppSelector />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tracker"
              element={
                <ProtectedRoute>
                  <TrackerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tracker/jobs"
              element={
                <ProtectedRoute>
                  <TrackerJobs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tracker/labels"
              element={
                <ProtectedRoute>
                  <TrackerLabels />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tracker/upload"
              element={
                <ProtectedRoute>
                  <TrackerUpload />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tracker/mobile"
              element={
                <ProtectedRoute>
                  <TrackerMobileScanner />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tracker/factory-floor"
              element={
                <ProtectedRoute>
                  <FactoryFloor />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </div>
    </AuthProvider>
  );
}

export default App;
