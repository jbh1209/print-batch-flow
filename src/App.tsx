import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import { Auth } from "@supabase/ui";
import { supabase } from "./integrations/supabase/client";
import "./App.css";
import Tracker from "./pages/tracker/Tracker";
import TrackerJobs from "./pages/tracker/TrackerJobs";
import TrackerLabels from "./pages/tracker/TrackerLabels";
import UploadExcel from "./pages/tracker/UploadExcel";
import ProductionJobDetails from "./pages/tracker/ProductionJobDetails";
import { AuthProvider } from "./hooks/useAuth";
import { Toaster } from "sonner";
import MobileTracker from "./pages/tracker/MobileTracker";
import FactoryFloor from "./pages/tracker/FactoryFloor";

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
      return <Navigate to="/login" />;
    }

    return <>{children}</>;
  };

  return (
    <AuthProvider>
      <div className="App">
        <Toaster richColors />
        <Router>
          <Routes>
            <Route
              path="/login"
              element={<Auth supabaseClient={supabase} />}
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Tracker />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tracker"
              element={
                <ProtectedRoute>
                  <Tracker />
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
                  <UploadExcel />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tracker/job/:id"
              element={
                <ProtectedRoute>
                  <ProductionJobDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tracker/mobile"
              element={
                <ProtectedRoute>
                  <MobileTracker />
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
