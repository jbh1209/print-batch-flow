
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
import ProductionJobDetails from "./pages/tracker/ProductionJobDetails";
import { AuthProvider } from "./hooks/useAuth";
import { Toaster } from "sonner";
import TrackerMobileScanner from "./pages/tracker/TrackerMobileScanner";
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
              element={
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                  <div className="max-w-md w-full space-y-8">
                    <div>
                      <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Sign in to your account
                      </h2>
                    </div>
                    <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                      <p className="text-center text-gray-600">
                        Please configure authentication to access the tracker system.
                      </p>
                    </div>
                  </div>
                </div>
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <TrackerDashboard />
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
