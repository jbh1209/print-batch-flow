
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
import TrackerProduction from "./pages/tracker/TrackerProduction";
import TrackerKanban from "./pages/tracker/TrackerKanban";
import TrackerWorkSheets from "./pages/tracker/TrackerWorkSheets";
import TrackerAdmin from "./pages/tracker/TrackerAdmin";
import TrackerLayout from "./components/TrackerLayout";
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
            
            {/* Tracker routes with layout */}
            <Route
              path="/tracker/*"
              element={
                <ProtectedRoute>
                  <TrackerLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<TrackerDashboard />} />
              <Route path="jobs" element={<TrackerJobs />} />
              <Route path="production" element={<TrackerProduction />} />
              <Route path="kanban" element={<TrackerKanban />} />
              <Route path="worksheets" element={<TrackerWorkSheets />} />
              <Route path="admin" element={<TrackerAdmin />} />
              <Route path="labels" element={<TrackerLabels />} />
              <Route path="upload" element={<TrackerUpload />} />
              <Route path="mobile" element={<TrackerMobileScanner />} />
            </Route>
            
            {/* Factory Floor - separate from main tracker layout */}
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
